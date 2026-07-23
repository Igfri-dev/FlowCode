"use server";

import { revalidatePath } from "next/cache";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "@/lib/db";
import {
  requireAdmin,
  requireTeacherOrAdmin,
  type SessionUser,
  type UserRole,
} from "@/lib/auth";
import { parseBulkUsersCsv } from "@/lib/csv-users";
import { deliverPendingEmails } from "@/lib/email";
import { sendEmailVerification } from "@/lib/email-verification";
import {
  getPasswordConfirmationError,
  getPasswordPolicyError,
  isValidEmail,
} from "@/lib/password-policy";
import { getUsernamePolicyError } from "@/lib/username-policy";
import {
  provisionUsers,
  maximumStudentsPerOrganization,
  UserProvisioningError,
  type UserProvisioningInput,
} from "@/lib/user-provisioning";
import { parseExerciseTestCases } from "@/lib/flow-test-runner";
import { ensureRuntimeSchema } from "@/lib/schema";
import type { ExerciseDifficulty } from "@/features/exercises/types";
import { getExercises } from "@/features/exercises/data/exercises";
import { normalizeSubmissionDeadlineInput } from "@/lib/submission-deadline";
import { getExerciseCreationOrganizationId } from "@/lib/exercise-scope";

const difficulties = ["facil", "media", "dificil"] as const;
const submissionStatuses = [
  "submitted",
  "approved",
  "incomplete",
  "rejected",
] as const;
const userGroupTypes = [
  "organization",
  "course",
  "administrators",
  "custom",
] as const;

type UserGroupType = (typeof userGroupTypes)[number];

type OrganizationScopeRow = RowDataPacket & {
  id: number;
};

type UserScopeRow = RowDataPacket & {
  id: number;
  role: UserRole;
  organization_id: number | null;
};

type UserGroupScopeRow = RowDataPacket & {
  id: number;
  group_type: UserGroupType;
  organization_id: number | null;
};

type ExerciseScopeRow = RowDataPacket & {
  organization_id: number | null;
};

export async function createOrganizationAction(formData: FormData) {
  const admin = await requireAdmin();
  await ensureRuntimeSchema();
  const name = String(formData.get("name") ?? "").trim().slice(0, 160);

  if (!name) {
    return;
  }

  await getPool().execute(
    `INSERT INTO organizations (name, slug, created_by)
     VALUES (:name, :slug, :createdBy)`,
    {
      createdBy: admin.id,
      name,
      slug: createSlug(name),
    },
  );

  revalidatePath("/admin/organizations");
  revalidatePath("/admin/users");
  revalidatePath("/admin/exercises");
}

export type UserCreationState = {
  status?: "success" | "error" | "warning";
  message?: string;
  created?: number;
  errors?: string[];
};

export type UserManagementState = {
  status?: "success" | "error";
  message?: string;
};

export async function createUserAction(
  _state: UserCreationState,
  formData: FormData,
): Promise<UserCreationState> {
  const creator = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();

  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  const role = String(formData.get("role") ?? "");

  if (
    !username ||
    !fullName ||
    !email ||
    !isValidEmail(email) ||
    (role !== "student" && role !== "teacher" && role !== "admin") ||
    (creator.role === "teacher" && role !== "student")
  ) {
    return { status: "error", message: "Revisa los datos del usuario." };
  }

  const usernameError = getUsernamePolicyError(username);
  if (usernameError) {
    return { status: "error", message: usernameError };
  }

  const passwordConfirmationError = getPasswordConfirmationError(
    password,
    passwordConfirmation,
  );
  if (passwordConfirmationError) {
    return { status: "error", message: passwordConfirmationError };
  }

  if (password) {
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      return { status: "error", message: passwordError };
    }
  }

  try {
    const result = await provisionUsers({
      creator,
      users: [
        {
          fullName,
          username,
          email,
          password,
          role,
          organizationId:
            role === "admin" ? null : Number(formData.get("organizationId")),
        },
      ],
    });
    const delivery = await deliverPendingEmails(10, result.outboxIds);

    revalidatePath("/admin/users");
    revalidatePath("/admin/organizations");

    return {
      status: delivery.configured && delivery.failed === 0 ? "success" : "warning",
      created: result.created,
      message: formatDeliveryMessage(result.created, delivery),
    };
  } catch (error) {
    if (error instanceof UserProvisioningError) {
      return { status: "error", message: error.message };
    }

    throw error;
  }
}

export async function bulkCreateUsersAction(
  _state: UserCreationState,
  formData: FormData,
): Promise<UserCreationState> {
  const creator = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const file = formData.get("csvFile");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecciona un archivo CSV." };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { status: "error", message: "El archivo no puede superar 2 MB." };
  }

  const parsed = parseBulkUsersCsv(await file.text());

  if (!parsed.ok) {
    return {
      status: "error",
      message: "Corrige el archivo antes de volver a subirlo.",
      errors: parsed.errors.slice(0, 30),
    };
  }

  const inputs: UserProvisioningInput[] = parsed.rows.map((row) => ({
    line: row.line,
    fullName: row.fullName,
    username: row.username,
    email: row.email,
    password: row.password,
    role: row.role,
    organizationReference: row.organization,
  }));

  try {
    const result = await provisionUsers({ creator, users: inputs });
    const delivery = await deliverPendingEmails(100, result.outboxIds);

    revalidatePath("/admin/users");
    revalidatePath("/admin/organizations");

    return {
      status: delivery.configured && delivery.failed === 0 ? "success" : "warning",
      created: result.created,
      message: formatDeliveryMessage(result.created, delivery),
    };
  } catch (error) {
    if (error instanceof UserProvisioningError) {
      return { status: "error", message: error.message };
    }

    throw error;
  }
}

export async function retryPendingEmailsAction() {
  await requireAdmin();
  await ensureRuntimeSchema();
  await deliverPendingEmails(100);

  revalidatePath("/admin/users");
}

export async function updateUserOrganizationAction(formData: FormData) {
  await requireAdmin();
  await ensureRuntimeSchema();
  const userId = Number(formData.get("userId"));
  const organizationId = Number(formData.get("organizationId"));

  if (!isPositiveInteger(userId)) {
    return;
  }

  const [users] = await getPool().query<UserScopeRow[]>(
    `SELECT id, role, organization_id FROM users WHERE id = :userId LIMIT 1`,
    { userId },
  );
  const user = users[0];

  if (!user || (user.role !== "student" && user.role !== "teacher")) {
    return;
  }

  if (!(await organizationExists(organizationId))) {
    return;
  }

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(
      "SELECT id FROM organizations WHERE id = :organizationId FOR UPDATE",
      { organizationId },
    );

    if (user.role === "student" && user.organization_id !== organizationId) {
      const [countRows] = await connection.query<
        (RowDataPacket & { count: number })[]
      >(
        `SELECT COUNT(*) AS count
         FROM users
         WHERE organization_id = :organizationId AND role = 'student'`,
        { organizationId },
      );

      if (Number(countRows[0]?.count ?? 0) >= maximumStudentsPerOrganization) {
        await connection.rollback();
        return;
      }
    }

    await connection.execute(
      `UPDATE users SET organization_id = :organizationId WHERE id = :userId`,
      { organizationId, userId },
    );
    await connection.execute(
      `DELETE member
       FROM user_group_members member
       INNER JOIN user_groups user_group ON user_group.id = member.group_id
       WHERE member.user_id = :userId
         AND user_group.organization_id IS NOT NULL
         AND user_group.organization_id <> :organizationId`,
      { organizationId, userId },
    );
    await connection.execute(
      `INSERT IGNORE INTO user_group_members (group_id, user_id)
       SELECT id, :userId
       FROM user_groups
       WHERE organization_id = :organizationId
         AND group_type = 'organization'`,
      { organizationId, userId },
    );

    if (user.role === "student") {
      await connection.execute(
        `UPDATE submissions s
         LEFT JOIN exercises e ON e.id = s.exercise_id
         SET s.organization_id = :organizationId,
             s.exercise_id = CASE
               WHEN e.organization_id IS NULL OR e.organization_id = :organizationId
                 THEN s.exercise_id
               ELSE NULL
             END
         WHERE s.student_id = :userId`,
        { organizationId, userId },
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/organizations");
}

export async function updateUserEmailAction(formData: FormData) {
  const editor = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const userId = Number(formData.get("userId"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!isPositiveInteger(userId) || !isValidEmail(email)) {
    return;
  }

  try {
    const [result] = await getPool().execute(
      `UPDATE users
       SET email = :email, email_verified_at = NULL
       WHERE id = :userId
         AND (
           :isAdmin = 1
           OR (organization_id = :organizationId AND role = 'student')
         )`,
      {
        email,
        userId,
        isAdmin: editor.role === "admin" ? 1 : 0,
        organizationId: editor.organizationId,
      },
    );
    if (Number((result as { affectedRows: number }).affectedRows) > 0) {
      await sendEmailVerification(userId, { ignoreCooldown: true });
    }
  } catch (error) {
    if (!isDuplicateEntry(error)) {
      throw error;
    }
  }

  revalidatePath("/admin/users");
}

export async function createUserGroupAction(
  _state: UserManagementState,
  formData: FormData,
): Promise<UserManagementState> {
  const creator = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const name = String(formData.get("name") ?? "").trim().slice(0, 160);
  const type = String(formData.get("type") ?? "");

  if (!name || !isUserGroupType(type)) {
    return { status: "error", message: "Indica un nombre y tipo de grupo válidos." };
  }

  if (
    creator.role === "teacher" &&
    (type !== "course" && type !== "custom")
  ) {
    return { status: "error", message: "No puedes crear ese tipo de grupo." };
  }

  if (
    creator.role === "teacher" &&
    !isPositiveInteger(creator.organizationId ?? 0)
  ) {
    return {
      status: "error",
      message: "Tu cuenta debe pertenecer a una organización activa.",
    };
  }

  const requestedOrganizationId = Number(formData.get("organizationId"));
  const organizationId =
    creator.role === "teacher"
      ? creator.organizationId
      : type === "administrators"
        ? null
        : isPositiveInteger(requestedOrganizationId)
          ? requestedOrganizationId
          : null;
  const requiresOrganization = type === "organization" || type === "course";

  if (
    (requiresOrganization && !isPositiveInteger(organizationId ?? 0)) ||
    (organizationId !== null && !(await organizationExists(organizationId)))
  ) {
    return { status: "error", message: "Selecciona una organización válida." };
  }

  const [duplicates] = await getPool().query<(RowDataPacket & { id: number })[]>(
    `SELECT id
     FROM user_groups
     WHERE name = :name
       AND organization_id <=> :organizationId
     LIMIT 1`,
    { name, organizationId },
  );

  if (duplicates[0]) {
    return { status: "error", message: "Ya existe un grupo con ese nombre en este ámbito." };
  }

  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO user_groups (organization_id, name, group_type, created_by)
     VALUES (:organizationId, :name, :type, :createdBy)`,
    { organizationId, name, type, createdBy: creator.id },
  );

  if (type === "organization" && organizationId !== null) {
    await getPool().execute(
      `INSERT IGNORE INTO user_group_members (group_id, user_id)
       SELECT :groupId, id
       FROM users
       WHERE organization_id = :organizationId
         AND role IN ('student', 'teacher')`,
      { groupId: result.insertId, organizationId },
    );
  } else if (type === "administrators") {
    await getPool().execute(
      `INSERT IGNORE INTO user_group_members (group_id, user_id)
       SELECT :groupId, id FROM users WHERE role = 'admin'`,
      { groupId: result.insertId },
    );
  }

  revalidatePath("/admin/users");
  return { status: "success", message: `Grupo «${name}» creado.` };
}

export async function manageSelectedUsersAction(
  _state: UserManagementState,
  formData: FormData,
): Promise<UserManagementState> {
  const editor = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const requestedIds = parseUserIds(formData.get("userIds"));
  const operation = String(formData.get("operation") ?? "");

  if (requestedIds.length === 0) {
    return { status: "error", message: "Selecciona al menos un usuario." };
  }

  const users = await getManageableUsers(requestedIds, editor);

  if (users.length === 0) {
    return {
      status: "error",
      message: "Ninguna de las cuentas seleccionadas puede modificarse.",
    };
  }

  if (operation === "activate" || operation === "deactivate") {
    const userIds = toSqlIntegerList(users.map((user) => user.id));
    await getPool().execute(
      `UPDATE users SET is_active = :isActive WHERE id IN (${userIds})`,
      { isActive: operation === "activate" ? 1 : 0 },
    );
    revalidateUserManagementData();
    return {
      status: "success",
      message: `${users.length} cuenta(s) ${operation === "activate" ? "activada(s)" : "desactivada(s)"}.`,
    };
  }

  if (operation === "delete") {
    await deleteUsersPermanently(users.map((user) => user.id));
    revalidateUserManagementData();
    return {
      status: "success",
      message: `${users.length} cuenta(s) y sus datos asociados fueron eliminados.`,
    };
  }

  if (operation === "addToGroup" || operation === "removeFromGroup") {
    const groupId = Number(formData.get("groupId"));
    const group = await getManageableUserGroup(groupId, editor);

    if (!group) {
      return { status: "error", message: "Selecciona un grupo válido." };
    }

    const compatibleUsers = users.filter((user) =>
      isUserCompatibleWithGroup(user, group),
    );

    if (compatibleUsers.length === 0) {
      return {
        status: "error",
        message: "Los usuarios seleccionados no son compatibles con ese grupo.",
      };
    }

    const userIds = toSqlIntegerList(compatibleUsers.map((user) => user.id));

    if (operation === "addToGroup") {
      await getPool().execute(
        `INSERT IGNORE INTO user_group_members (group_id, user_id)
         SELECT :groupId, id FROM users WHERE id IN (${userIds})`,
        { groupId: group.id },
      );
    } else {
      await getPool().execute(
        `DELETE FROM user_group_members
         WHERE group_id = :groupId AND user_id IN (${userIds})`,
        { groupId: group.id },
      );
    }

    revalidatePath("/admin/users");
    const skipped = users.length - compatibleUsers.length;
    return {
      status: "success",
      message: `${compatibleUsers.length} usuario(s) ${operation === "addToGroup" ? "añadido(s) al" : "quitado(s) del"} grupo${skipped ? `; ${skipped} incompatible(s) se omitieron` : ""}.`,
    };
  }

  if (operation === "assignOrganization") {
    if (editor.role !== "admin") {
      return { status: "error", message: "Solo un administrador puede cambiar organizaciones." };
    }

    const organizationId = Number(formData.get("organizationId"));

    if (!(await organizationExists(organizationId))) {
      return { status: "error", message: "Selecciona una organización válida." };
    }

    const assignableUsers = users.filter(
      (user) => user.role === "student" || user.role === "teacher",
    );

    if (assignableUsers.length === 0) {
      return { status: "error", message: "La selección no contiene alumnos ni profesores." };
    }

    const result = await assignUsersToOrganization(assignableUsers, organizationId);

    if (!result.ok) {
      return { status: "error", message: result.message };
    }

    revalidateUserManagementData();
    return {
      status: "success",
      message: `${assignableUsers.length} usuario(s) asignado(s) a la organización.`,
    };
  }

  return { status: "error", message: "Selecciona una acción masiva válida." };
}

export async function deleteUserAction(formData: FormData) {
  const editor = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const userId = Number(formData.get("userId"));

  if (!isPositiveInteger(userId)) {
    return;
  }

  const users = await getManageableUsers([userId], editor);

  if (users.length !== 1) {
    return;
  }

  await deleteUsersPermanently([userId]);
  revalidateUserManagementData();
}

export async function deleteUserGroupAction(formData: FormData) {
  const editor = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const groupId = Number(formData.get("groupId"));
  const group = await getManageableUserGroup(groupId, editor);

  if (!group) {
    return;
  }

  await getPool().execute("DELETE FROM user_groups WHERE id = :groupId", {
    groupId,
  });
  revalidatePath("/admin/users");
}

export async function deleteUserGroupWithUsersAction(formData: FormData) {
  const editor = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const groupId = Number(formData.get("groupId"));
  const group = await getManageableUserGroup(groupId, editor);

  if (!group) {
    return;
  }

  const [members] = await getPool().query<UserScopeRow[]>(
    `SELECT user.id, user.role, user.organization_id
     FROM user_group_members member
     INNER JOIN users user ON user.id = member.user_id
     WHERE member.group_id = :groupId
       AND user.id <> :editorId
       AND (
         :isAdmin = 1
         OR (user.organization_id = :organizationId AND user.role = 'student')
       )`,
    {
      groupId,
      editorId: editor.id,
      isAdmin: editor.role === "admin" ? 1 : 0,
      organizationId: editor.organizationId,
    },
  );
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM user_groups WHERE id = :groupId", {
      groupId,
    });

    if (members.length > 0) {
      const memberIds = toSqlIntegerList(members.map((user) => user.id));
      await connection.execute(
        `DELETE FROM email_outbox WHERE user_id IN (${memberIds})`,
      );
      await connection.execute(
        `DELETE FROM users WHERE id IN (${memberIds})`,
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  revalidateUserManagementData();
}

export async function createExerciseAction(formData: FormData) {
  const author = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const difficulty = String(formData.get("difficulty") ?? "");
  const starterCode = String(formData.get("starterCode") ?? "").trim();
  const testCases = String(formData.get("testCases") ?? "").trim();
  const tags = String(formData.get("tags") ?? "").trim();
  const submissionDeadline = normalizeSubmissionDeadlineInput(
    String(formData.get("submissionDeadline") ?? ""),
  );
  const organizationId = getExerciseCreationOrganizationId(author);
  const hasValidScope = organizationId !== undefined;

  if (
    !title ||
    !description ||
    !objective ||
    !testCases ||
    !hasValidScope ||
    !isDifficulty(difficulty)
  ) {
    return;
  }

  if (testCases) {
    parseExerciseTestCases(testCases);
  }

  await getPool().execute(
    `INSERT INTO exercises
       (organization_id, slug, title, description, objective, difficulty,
        starter_code, test_cases, submission_deadline, tags, created_by)
     VALUES
       (:organizationId, :slug, :title, :description, :objective, :difficulty,
        :starterCode, :testCases, :submissionDeadline, :tags, :createdBy)`,
    {
      slug: createSlug(title),
      title,
      organizationId,
      description,
      objective,
      difficulty,
      starterCode: starterCode || null,
      testCases: testCases || null,
      submissionDeadline,
      tags: tags || null,
      createdBy: author.id,
    },
  );

  revalidatePath("/admin/exercises");
  revalidatePath("/");
}

export async function updateExerciseAction(formData: FormData) {
  const editor = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const exerciseId = Number(formData.get("exerciseId"));
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const difficulty = String(formData.get("difficulty") ?? "");
  const starterCode = String(formData.get("starterCode") ?? "").trim();
  const testCases = String(formData.get("testCases") ?? "").trim();
  const tags = String(formData.get("tags") ?? "").trim();
  const submissionDeadline = normalizeSubmissionDeadlineInput(
    String(formData.get("submissionDeadline") ?? ""),
  );
  const existingExercise = isPositiveInteger(exerciseId)
    ? await getManageableExercise(exerciseId, editor)
    : null;
  if (isPositiveInteger(exerciseId) && !existingExercise) {
    return;
  }
  if (!isPositiveInteger(exerciseId) && editor.role !== "admin") {
    return;
  }
  const organizationId = existingExercise
    ? existingExercise.organization_id
    : null;
  const hasValidScope =
    editor.role === "admin" || isPositiveInteger(organizationId ?? 0);

  if (
    (!isPositiveInteger(exerciseId) && !isBuiltInExerciseId(sourceId)) ||
    !title ||
    !description ||
    !objective ||
    !testCases ||
    !hasValidScope ||
    !isDifficulty(difficulty)
  ) {
    return;
  }

  if (testCases) {
    parseExerciseTestCases(testCases);
  }

  const values = {
    exerciseId,
    organizationId,
    title,
    description,
    objective,
    difficulty,
    starterCode: starterCode || null,
    testCases: testCases || null,
    submissionDeadline,
    tags: tags || null,
  };

  if (isPositiveInteger(exerciseId)) {
    await getPool().execute(
      `UPDATE exercises
       SET title = :title,
           description = :description,
           objective = :objective,
           difficulty = :difficulty,
           starter_code = :starterCode,
           test_cases = :testCases,
           submission_deadline = :submissionDeadline,
           tags = :tags,
           is_active = 1,
           updated_at = NOW()
       WHERE id = :exerciseId
         AND (:isAdmin = 1 OR organization_id = :editorOrganizationId)`,
      {
        ...values,
        editorOrganizationId: editor.organizationId,
        isAdmin: editor.role === "admin" ? 1 : 0,
      },
    );
  } else {
    await getPool().execute(
      `INSERT INTO exercises
         (organization_id, slug, source_key, title, description, objective, difficulty,
          starter_code, test_cases, submission_deadline, tags, is_active, created_by)
       VALUES
         (:organizationId, :slug, :sourceId, :title, :description, :objective, :difficulty,
          :starterCode, :testCases, :submissionDeadline, :tags, 1, :createdBy)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         description = VALUES(description),
         objective = VALUES(objective),
         difficulty = VALUES(difficulty),
         starter_code = VALUES(starter_code),
         test_cases = VALUES(test_cases),
         submission_deadline = VALUES(submission_deadline),
         tags = VALUES(tags),
         is_active = 1,
         created_by = VALUES(created_by),
         updated_at = NOW()`,
      {
        ...values,
        slug: `global-builtin-${sourceId}`,
        sourceId,
        createdBy: editor.id,
      },
    );
  }

  revalidateExerciseData();
}

export async function deleteExerciseAction(formData: FormData) {
  const editor = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const exerciseId = Number(formData.get("exerciseId"));
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const existingExercise = isPositiveInteger(exerciseId)
    ? await getManageableExercise(exerciseId, editor)
    : null;

  if (
    isBuiltInExerciseId(sourceId) &&
    editor.role === "admin" &&
    (!isPositiveInteger(exerciseId) || existingExercise?.organization_id === null)
  ) {
    const exercise = getExercises("es").find((item) => item.id === sourceId)!;

    await getPool().execute(
      `INSERT INTO exercises
         (organization_id, slug, source_key, title, description, objective, difficulty,
          starter_code, tags, is_active, created_by)
       VALUES
         (:organizationId, :slug, :sourceId, :title, :description, :objective, :difficulty,
          :starterCode, :tags, 0, :createdBy)
       ON DUPLICATE KEY UPDATE is_active = 0, updated_at = NOW()`,
      {
        slug: `global-builtin-${sourceId}`,
        organizationId: null,
        sourceId,
        title: exercise.title,
        description: exercise.description,
        objective: exercise.objective,
        difficulty: exercise.difficulty,
        starterCode: exercise.starterCode ?? null,
        tags: exercise.tags?.join(", ") ?? null,
        createdBy: editor.id,
      },
    );

    revalidateExerciseData();
    return;
  }

  if (!isPositiveInteger(exerciseId)) {
    return;
  }

  if (!existingExercise) {
    return;
  }

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE submissions SET exercise_id = NULL WHERE exercise_id = :exerciseId",
      { exerciseId },
    );
    await connection.execute("DELETE FROM exercises WHERE id = :exerciseId", {
      exerciseId,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  revalidateExerciseData();
  revalidatePath("/admin/submissions");
}

export async function updateSubmissionReviewAction(formData: FormData) {
  const reviewer = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const submissionId = Number(formData.get("submissionId"));
  const status = String(formData.get("status") ?? "");
  const feedback = String(formData.get("feedback") ?? "").trim();

  if (!Number.isInteger(submissionId) || !isSubmissionStatus(status)) {
    return;
  }

  await getPool().execute(
    `UPDATE submissions
     SET status = :status,
         feedback = :feedback,
         reviewed_by = :reviewedBy,
         reviewed_at = NOW()
     WHERE id = :submissionId
       AND (:isAdmin = 1 OR organization_id = :organizationId)`,
    {
      status,
      feedback: feedback || null,
      reviewedBy: reviewer.id,
      submissionId,
      isAdmin: reviewer.role === "admin" ? 1 : 0,
      organizationId: reviewer.organizationId,
    },
  );

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
}

function isDifficulty(value: string): value is ExerciseDifficulty {
  return difficulties.includes(value as ExerciseDifficulty);
}

function isSubmissionStatus(
  value: string,
): value is (typeof submissionStatuses)[number] {
  return submissionStatuses.includes(
    value as (typeof submissionStatuses)[number],
  );
}

function isUserGroupType(value: string): value is UserGroupType {
  return userGroupTypes.includes(value as UserGroupType);
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function isBuiltInExerciseId(value: string) {
  return Boolean(value) && getExercises("es").some((exercise) => exercise.id === value);
}

function createSlug(value: string) {
  const baseSlug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${baseSlug || "exercise"}-${Date.now().toString(36)}`;
}

function revalidateExerciseData() {
  revalidatePath("/admin/exercises");
  revalidatePath("/");
  revalidatePath("/student/submissions");
}

function revalidateUserManagementData() {
  revalidatePath("/admin/users");
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/submissions");
  revalidatePath("/student/submissions");
  revalidatePath("/projects");
}

function parseUserIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => Number(item))
        .filter(isPositiveInteger),
    ),
  ).slice(0, 5000);
}

function toSqlIntegerList(ids: number[]) {
  return ids.map((id) => Math.trunc(id)).join(",");
}

async function deleteUsersPermanently(userIds: number[]) {
  if (userIds.length === 0) {
    return;
  }

  const ids = toSqlIntegerList(userIds);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `DELETE FROM email_outbox WHERE user_id IN (${ids})`,
    );
    await connection.execute(`DELETE FROM users WHERE id IN (${ids})`);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getManageableUsers(userIds: number[], editor: SessionUser) {
  if (userIds.length === 0) {
    return [];
  }

  const [users] = await getPool().query<UserScopeRow[]>(
    `SELECT id, role, organization_id
     FROM users
     WHERE id IN (${toSqlIntegerList(userIds)})
       AND id <> :editorId
       AND (
         :isAdmin = 1
         OR (organization_id = :organizationId AND role = 'student')
       )
     ORDER BY id`,
    {
      editorId: editor.id,
      isAdmin: editor.role === "admin" ? 1 : 0,
      organizationId: editor.organizationId,
    },
  );

  return users;
}

async function getManageableUserGroup(
  groupId: number,
  editor: SessionUser,
) {
  if (!isPositiveInteger(groupId)) {
    return null;
  }

  const [groups] = await getPool().query<UserGroupScopeRow[]>(
    `SELECT id, group_type, organization_id
     FROM user_groups
     WHERE id = :groupId
       AND (:isAdmin = 1 OR organization_id = :organizationId)
     LIMIT 1`,
    {
      groupId,
      isAdmin: editor.role === "admin" ? 1 : 0,
      organizationId: editor.organizationId,
    },
  );

  return groups[0] ?? null;
}

function isUserCompatibleWithGroup(
  user: UserScopeRow,
  group: UserGroupScopeRow,
) {
  if (group.group_type === "administrators") {
    return group.organization_id === null && user.role === "admin";
  }

  if (group.organization_id !== null) {
    if (user.organization_id !== group.organization_id) {
      return false;
    }

    if (group.group_type === "course") {
      return user.role === "student";
    }

    return user.role === "student" || user.role === "teacher";
  }

  return group.group_type === "custom";
}

async function assignUsersToOrganization(
  users: UserScopeRow[],
  organizationId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(
      "SELECT id FROM organizations WHERE id = :organizationId FOR UPDATE",
      { organizationId },
    );
    const movingStudents = users.filter(
      (user) =>
        user.role === "student" && user.organization_id !== organizationId,
    );

    if (movingStudents.length > 0) {
      const [countRows] = await connection.query<
        (RowDataPacket & { count: number })[]
      >(
        `SELECT COUNT(*) AS count
         FROM users
         WHERE organization_id = :organizationId AND role = 'student'`,
        { organizationId },
      );
      const studentCount = Number(countRows[0]?.count ?? 0);

      if (
        studentCount + movingStudents.length >
        maximumStudentsPerOrganization
      ) {
        await connection.rollback();
        return {
          ok: false,
          message: `La organización superaría el máximo de ${maximumStudentsPerOrganization} alumnos.`,
        };
      }
    }

    const userIds = toSqlIntegerList(users.map((user) => user.id));
    await connection.execute(
      `UPDATE users SET organization_id = :organizationId WHERE id IN (${userIds})`,
      { organizationId },
    );
    await connection.execute(
      `DELETE member
       FROM user_group_members member
       INNER JOIN user_groups user_group ON user_group.id = member.group_id
       WHERE member.user_id IN (${userIds})
         AND user_group.organization_id IS NOT NULL
         AND user_group.organization_id <> :organizationId`,
      { organizationId },
    );
    await connection.execute(
      `INSERT IGNORE INTO user_group_members (group_id, user_id)
       SELECT user_group.id, user.id
       FROM user_groups user_group
       INNER JOIN users user ON user.id IN (${userIds})
       WHERE user_group.organization_id = :organizationId
         AND user_group.group_type = 'organization'
         AND user.role IN ('student', 'teacher')`,
      { organizationId },
    );
    const studentIds = users
      .filter((user) => user.role === "student")
      .map((user) => user.id);

    if (studentIds.length > 0) {
      await connection.execute(
        `UPDATE submissions s
         LEFT JOIN exercises e ON e.id = s.exercise_id
         SET s.organization_id = :organizationId,
             s.exercise_id = CASE
               WHEN e.organization_id IS NULL OR e.organization_id = :organizationId
                 THEN s.exercise_id
               ELSE NULL
             END
         WHERE s.student_id IN (${toSqlIntegerList(studentIds)})`,
        { organizationId },
      );
    }

    await connection.commit();
    return { ok: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function organizationExists(organizationId: number) {
  if (!isPositiveInteger(organizationId)) {
    return false;
  }

  const [organizations] = await getPool().query<OrganizationScopeRow[]>(
    `SELECT id
     FROM organizations
     WHERE id = :organizationId AND is_active = 1
     LIMIT 1`,
    { organizationId },
  );

  return Boolean(organizations[0]);
}

async function getManageableExercise(
  exerciseId: number,
  viewer: SessionUser,
) {
  const [exercises] = await getPool().query<ExerciseScopeRow[]>(
    `SELECT organization_id
     FROM exercises
     WHERE id = :exerciseId
       AND (:isAdmin = 1 OR organization_id = :organizationId)
     LIMIT 1`,
    {
      exerciseId,
      isAdmin: viewer.role === "admin" ? 1 : 0,
      organizationId: viewer.organizationId,
    },
  );

  return exercises[0] ?? null;
}

function formatDeliveryMessage(
  created: number,
  delivery: {
    sent: number;
    failed: number;
    pending: number;
    configured: boolean;
  },
) {
  const accountLabel = created === 1 ? "cuenta creada" : "cuentas creadas";

  if (!delivery.configured) {
    return `${created} ${accountLabel}. Los correos quedaron cifrados y pendientes hasta configurar SMTP.`;
  }

  if (delivery.failed > 0 || delivery.pending > 0) {
    return `${created} ${accountLabel}; ${delivery.sent} correos enviados y ${delivery.failed + delivery.pending} pendientes de reintento.`;
  }

  return `${created} ${accountLabel} y ${delivery.sent} correos enviados.`;
}

function isDuplicateEntry(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY"
  );
}
