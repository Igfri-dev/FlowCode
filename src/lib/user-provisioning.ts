import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { SessionUser, UserRole } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { canEncryptEmailQueue, queueWelcomeEmail } from "@/lib/email";
import {
  createEmailVerificationUrl,
  issueEmailVerificationToken,
} from "@/lib/email-verification";
import { hashPassword } from "@/lib/password";
import { generateTemporaryPassword } from "@/lib/password-policy";
import { getUsernamePolicyError } from "@/lib/username-policy";

export const maximumStudentsPerOrganization = 60;

export type UserProvisioningInput = {
  line?: number;
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: Extract<UserRole, "student" | "teacher" | "admin">;
  organizationReference?: string;
  organizationId?: number | null;
};

export class UserProvisioningError extends Error {}

type OrganizationRow = RowDataPacket & {
  id: number;
  name: string;
  slug: string;
};

type DuplicateRow = RowDataPacket & {
  username: string;
  email: string | null;
};

type StudentCountRow = RowDataPacket & {
  organization_id: number;
  student_count: number;
};

type PreparedUser = UserProvisioningInput & {
  organizationId: number | null;
  plainPassword: string;
  passwordHash: string;
  passwordWasGenerated: boolean;
};

export async function provisionUsers({
  creator,
  users,
}: {
  creator: SessionUser;
  users: UserProvisioningInput[];
}) {
  if (!users.length) {
    throw new UserProvisioningError("No hay usuarios para crear.");
  }

  for (const user of users) {
    const usernameError = getUsernamePolicyError(user.username);
    if (usernameError) {
      throw rowError(user, usernameError);
    }
  }

  if (!canEncryptEmailQueue()) {
    throw new UserProvisioningError(
      "Configura EMAIL_QUEUE_SECRET antes de crear cuentas con correo.",
    );
  }

  const organizations = await loadActiveOrganizations();
  const preparedUsers = await Promise.all(
    users.map(async (input) => {
      const organizationId = resolveOrganizationId({
        creator,
        input,
        organizations,
      });
      const passwordWasGenerated = !input.password;
      const plainPassword = input.password || generateTemporaryPassword();

      return {
        ...input,
        organizationId,
        plainPassword,
        passwordHash: await hashPassword(plainPassword),
        passwordWasGenerated,
      } satisfies PreparedUser;
    }),
  );
  const connection = await getPool().getConnection();
  const created: Array<PreparedUser & { id: number }> = [];

  try {
    await connection.beginTransaction();
    await lockAndValidateOrganizationCapacity(connection, preparedUsers);
    await ensureAccountsDoNotExist(connection, preparedUsers);

    for (const user of preparedUsers) {
      const [result] = await connection.execute(
        `INSERT INTO users
           (organization_id, username, email, password_hash, full_name, role,
            must_change_password)
         VALUES
           (:organizationId, :username, :email, :passwordHash, :fullName, :role, 1)`,
        {
          organizationId: user.organizationId,
          username: user.username,
          email: user.email,
          passwordHash: user.passwordHash,
          fullName: user.fullName,
          role: user.role,
        },
      );
      created.push({
        ...user,
        id: Number((result as { insertId: number }).insertId),
      });
    }

    if (created.length > 0) {
      await connection.execute(
        `INSERT IGNORE INTO user_group_members (group_id, user_id)
         SELECT user_group.id, user.id
         FROM user_groups user_group
         INNER JOIN users user
           ON (
             user_group.group_type = 'organization'
             AND user_group.organization_id = user.organization_id
             AND user.role IN ('student', 'teacher')
           ) OR (
             user_group.group_type = 'administrators'
             AND user_group.organization_id IS NULL
             AND user.role = 'admin'
           )
         WHERE user.id IN (${created.map((user) => user.id).join(",")})`,
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();

    if (isDuplicateEntry(error)) {
      throw new UserProvisioningError(
        "Uno de los usuarios o correos ya existe. No se creó ninguna cuenta.",
      );
    }

    throw error;
  } finally {
    connection.release();
  }

  let queued = 0;
  const outboxIds: number[] = [];

  for (const user of created) {
    const verification = await issueEmailVerificationToken(user.id, {
      ignoreCooldown: true,
    });

    if (verification.status !== "issued") {
      throw new Error("No se pudo crear la verificación de correo.");
    }

    const outboxId = await queueWelcomeEmail({
      email: user.email,
      fullName: user.fullName,
      password: user.plainPassword,
      passwordWasGenerated: user.passwordWasGenerated,
      userId: user.id,
      username: user.username,
      verificationUrl: createEmailVerificationUrl(verification.token),
    });
    outboxIds.push(outboxId);
    queued += 1;
  }

  return { created: created.length, queued, outboxIds };
}

async function loadActiveOrganizations() {
  const [rows] = await getPool().query<OrganizationRow[]>(
    `SELECT id, name, slug
     FROM organizations
     WHERE is_active = 1
     ORDER BY id`,
  );

  return rows;
}

function resolveOrganizationId({
  creator,
  input,
  organizations,
}: {
  creator: SessionUser;
  input: UserProvisioningInput;
  organizations: OrganizationRow[];
}) {
  if (creator.role === "teacher") {
    if (input.role !== "student" || !creator.organizationId) {
      throw rowError(input, "los profesores solo pueden crear alumnos de su organización.");
    }

    const ownOrganization = organizations.find(
      (organization) => organization.id === creator.organizationId,
    );
    const reference = normalizeReference(input.organizationReference ?? "");

    if (
      reference &&
      ownOrganization &&
      reference !== normalizeReference(ownOrganization.name) &&
      reference !== normalizeReference(ownOrganization.slug)
    ) {
      throw rowError(
        input,
        `la organización debe ser ${ownOrganization.name}.`,
      );
    }

    return creator.organizationId;
  }

  if (creator.role !== "admin") {
    throw new UserProvisioningError("No tienes permiso para crear usuarios.");
  }

  if (input.role === "admin") {
    return null;
  }

  const explicitOrganization = input.organizationId
    ? organizations.find((organization) => organization.id === input.organizationId)
    : null;
  const reference = normalizeReference(input.organizationReference ?? "");
  const slugOrganization = reference
    ? organizations.find(
        (organization) => normalizeReference(organization.slug) === reference,
      )
    : null;
  const nameOrganizations = reference
    ? organizations.filter(
        (organization) => normalizeReference(organization.name) === reference,
      )
    : [];

  if (!explicitOrganization && !slugOrganization && nameOrganizations.length > 1) {
    throw rowError(
      input,
      "el nombre de organización es ambiguo; usa su identificador slug.",
    );
  }

  const referencedOrganization = slugOrganization ?? nameOrganizations[0] ?? null;
  const organization = explicitOrganization ?? referencedOrganization;

  if (!organization) {
    throw rowError(input, "indica una organización activa y existente.");
  }

  return organization.id;
}

async function lockAndValidateOrganizationCapacity(
  connection: PoolConnection,
  users: PreparedUser[],
) {
  const organizationIds = Array.from(
    new Set(
      users.flatMap((user) =>
        user.organizationId ? [user.organizationId] : [],
      ),
    ),
  ).sort((a, b) => a - b);

  if (!organizationIds.length) {
    return;
  }

  await connection.query(
    `SELECT id FROM organizations
     WHERE id IN (${organizationIds.join(",")})
     ORDER BY id FOR UPDATE`,
  );
  const [countRows] = await connection.query<StudentCountRow[]>(
    `SELECT organization_id, COUNT(*) AS student_count
     FROM users
     WHERE role = 'student'
       AND organization_id IN (${organizationIds.join(",")})
     GROUP BY organization_id`,
  );
  const currentCounts = new Map(
    countRows.map((row) => [row.organization_id, Number(row.student_count)]),
  );
  const addedCounts = new Map<number, number>();

  for (const user of users) {
    if (user.role !== "student" || !user.organizationId) {
      continue;
    }

    addedCounts.set(
      user.organizationId,
      (addedCounts.get(user.organizationId) ?? 0) + 1,
    );
  }

  for (const [organizationId, added] of addedCounts) {
    const total = (currentCounts.get(organizationId) ?? 0) + added;
    if (total > maximumStudentsPerOrganization) {
      throw new UserProvisioningError(
        `La organización superaría el máximo de ${maximumStudentsPerOrganization} estudiantes. Para ampliar el cupo, contacta a contacto@igfri.dev.`,
      );
    }
  }
}

async function ensureAccountsDoNotExist(
  connection: PoolConnection,
  users: PreparedUser[],
) {
  const usernames = users.map((user) => user.username);
  const emails = users.map((user) => user.email);
  const [duplicates] = await connection.query<DuplicateRow[]>(
    "SELECT username, email FROM users WHERE username IN (?) OR email IN (?)",
    [usernames, emails],
  );

  if (!duplicates.length) {
    return;
  }

  const duplicateUsername = duplicates.find((duplicate) =>
    users.some(
      (user) =>
        user.username.toLocaleLowerCase() ===
        duplicate.username.toLocaleLowerCase(),
    ),
  );

  if (duplicateUsername) {
    const input = users.find(
      (user) =>
        user.username.toLocaleLowerCase() ===
        duplicateUsername.username.toLocaleLowerCase(),
    )!;
    throw rowError(
      input,
      `el nombre de usuario ${input.username} ya está ocupado.`,
    );
  }

  const duplicateEmail = duplicates.find((duplicate) =>
    users.some(
      (user) =>
        user.email.toLocaleLowerCase() ===
        duplicate.email?.toLocaleLowerCase(),
    ),
  );
  const input = users.find(
    (user) =>
      user.email.toLocaleLowerCase() ===
      duplicateEmail?.email?.toLocaleLowerCase(),
  );

  throw rowError(
    input ?? users[0],
    `el correo ${input?.email ?? "indicado"} ya está registrado.`,
  );
}

function normalizeReference(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

function rowError(input: UserProvisioningInput, message: string) {
  return new UserProvisioningError(
    `${input.line ? `Línea ${input.line}: ` : ""}${message}`,
  );
}

function isDuplicateEntry(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY"
  );
}
