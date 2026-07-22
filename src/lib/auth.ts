import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";
import { getPool, queryOne, queryRows } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ensureRuntimeSchema } from "@/lib/schema";

const sessionCookieName = "flowcode_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export const userRoles = ["student", "teacher", "admin", "independent"] as const;
export type UserRole = (typeof userRoles)[number];

export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  emailVerified: boolean;
  role: UserRole;
  mustChangePassword: boolean;
  organizationId: number | null;
  organizationName: string | null;
};

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  email: string | null;
  email_verified_at: Date | null;
  role: UserRole;
  must_change_password: number;
  is_active: number;
  organization_id: number | null;
  organization_name: string | null;
};

type SessionRow = RowDataPacket & {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  email_verified_at: Date | null;
  role: UserRole;
  must_change_password: number;
  organization_id: number | null;
  organization_name: string | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isUserRole(value: string): value is UserRole {
  return userRoles.includes(value as UserRole);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  await ensureRuntimeSchema();
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const user = await queryOne<SessionRow>(
    `SELECT u.id, u.username, u.full_name, u.email, u.email_verified_at, u.role,
            u.must_change_password, u.organization_id,
            organization.name AS organization_name
     FROM user_sessions s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN organizations organization ON organization.id = u.organization_id
     WHERE s.token_hash = :tokenHash
       AND s.expires_at > NOW()
       AND u.is_active = 1
       AND (
         u.role = 'admin'
         OR (u.role = 'independent' AND u.email_verified_at IS NOT NULL)
         OR organization.is_active = 1
       )
     LIMIT 1`,
    { tokenHash: hashToken(token) },
  );

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    emailVerified: Boolean(user.email_verified_at),
    role: user.role,
    mustChangePassword: user.must_change_password === 1,
    organizationId: user.organization_id,
    organizationName: user.organization_name,
  };
}

export async function requireUser() {
  const user = await requireUserAllowingPasswordChange();

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return user;
}

export async function requireUserAllowingPasswordChange() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "admin") {
    redirect("/");
  }

  return user;
}

export async function requireTeacherOrAdmin() {
  const user = await requireUser();

  if (user.role !== "teacher" && user.role !== "admin") {
    redirect("/");
  }

  return user;
}

export async function authenticateUser(username: string, password: string) {
  await ensureRuntimeSchema();
  await ensureBootstrapAdmin();

  const user = await queryOne<UserRow>(
    `SELECT u.id, u.username, u.password_hash, u.full_name, u.email,
            u.email_verified_at, u.role,
            u.must_change_password, u.is_active,
            u.organization_id, organization.name AS organization_name
     FROM users u
     LEFT JOIN organizations organization ON organization.id = u.organization_id
     WHERE u.username = :username
       AND (
         u.role = 'admin'
         OR (u.role = 'independent' AND u.email_verified_at IS NOT NULL)
         OR organization.is_active = 1
       )
     LIMIT 1`,
    { username },
  );

  if (!user || user.is_active !== 1) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    emailVerified: Boolean(user.email_verified_at),
    role: user.role,
    mustChangePassword: user.must_change_password === 1,
    organizationId: user.organization_id,
    organizationName: user.organization_name,
  } satisfies SessionUser;
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);

  await getPool().execute(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES (:userId, :tokenHash, :expiresAt)`,
    {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  );

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    await getPool().execute(
      "DELETE FROM user_sessions WHERE token_hash = :tokenHash",
      { tokenHash: hashToken(token) },
    );
  }

  cookieStore.delete(sessionCookieName);
}

export async function destroyAllUserSessions(userId: number) {
  await getPool().execute("DELETE FROM user_sessions WHERE user_id = :userId", {
    userId,
  });
}

async function ensureBootstrapAdmin() {
  const username = process.env.FLOWCODE_BOOTSTRAP_ADMIN_USERNAME;
  const password = process.env.FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD;

  if (!username || !password) {
    return;
  }

  const existingUsers = await queryRows<RowDataPacket & { count: number }>(
    "SELECT COUNT(*) AS count FROM users",
  );

  if ((existingUsers[0]?.count ?? 0) > 0) {
    return;
  }

  await getPool().execute(
    `INSERT INTO users (username, password_hash, full_name, role)
     VALUES (:username, :passwordHash, :fullName, 'admin')`,
    {
      username,
      passwordHash: await hashPassword(password),
      fullName: "Administrator",
    },
  );
}
