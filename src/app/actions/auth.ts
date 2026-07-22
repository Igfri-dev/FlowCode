"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";
import {
  authenticateUser,
  createSession,
  destroyAllUserSessions,
  destroySession,
  requireUserAllowingPasswordChange,
} from "@/lib/auth";
import { getPool, queryOne } from "@/lib/db";
import {
  canEncryptEmailQueue,
  deliverPendingEmails,
  getApplicationUrl,
  isSmtpConfigured,
  queuePasswordResetEmail,
} from "@/lib/email";
import {
  sendEmailVerification,
  verifyEmailToken,
} from "@/lib/email-verification";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getPasswordPolicyError, isValidEmail } from "@/lib/password-policy";
import { ensureRuntimeSchema } from "@/lib/schema";
import { verifyTurnstileToken } from "@/lib/turnstile";

export type LoginState = {
  message?: string;
};

export type AuthFormState = {
  status?: "success" | "error" | "warning";
  message?: string;
  complete?: boolean;
};

type PasswordUserRow = RowDataPacket & {
  id: number;
  password_hash: string;
};

type ResetUserRow = RowDataPacket & {
  id: number;
  email: string;
  full_name: string;
};

type ResetTokenRow = RowDataPacket & {
  id: number;
  user_id: number;
};

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { message: "Introduce tu usuario y contraseña." };
  }

  const user = await authenticateUser(username, password);

  if (!user) {
    return { message: "El usuario o la contraseña no son correctos." };
  }

  await createSession(user.id);

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  redirect(user.role === "admin" || user.role === "teacher" ? "/admin" : "/");
}

export async function registerIndependentAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await ensureRuntimeSchema();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  const turnstileToken = String(formData.get("cf-turnstile-response") ?? "");

  if (!fullName || !username || !email) {
    return { status: "error", message: "Completa todos los campos." };
  }

  if (fullName.length > 160 || username.length > 80 || !isValidEmail(email)) {
    return { status: "error", message: "Revisa el nombre, usuario y correo." };
  }

  const passwordError = getPasswordPolicyError(password);
  if (passwordError) {
    return { status: "error", message: passwordError };
  }

  if (password !== passwordConfirmation) {
    return { status: "error", message: "Las contraseñas no coinciden." };
  }

  if (!isSmtpConfigured() || !canEncryptEmailQueue()) {
    return {
      status: "error",
      message:
        "El registro personal está temporalmente deshabilitado hasta configurar el correo SMTP.",
    };
  }

  const turnstile = await verifyTurnstileToken(turnstileToken, "register");
  if (!turnstile.ok) {
    return { status: "error", message: turnstile.reason };
  }

  let userId: number | null = null;
  try {
    const [result] = await getPool().execute(
      `INSERT INTO users
         (organization_id, username, email, password_hash, full_name, role, must_change_password)
       VALUES (NULL, :username, :email, :passwordHash, :fullName, 'independent', 0)`,
      {
        username,
        email,
        passwordHash: await hashPassword(password),
        fullName,
      },
    );
    userId = Number((result as { insertId: number }).insertId);
    const verification = await sendEmailVerification(userId, {
      ignoreCooldown: true,
    });

    if (verification.status !== "issued") {
      throw new Error("No se pudo preparar la verificación del correo.");
    }

    return {
      status:
        verification.delivery.failed > 0 || verification.delivery.pending > 0
          ? "warning"
          : "success",
      complete: true,
      message:
        verification.delivery.failed > 0
          ? "La cuenta fue creada, pero el correo no pudo enviarse. Puedes solicitar un nuevo enlace en unos minutos."
          : "Cuenta creada. Revisa tu correo para activarla antes de iniciar sesión.",
    };
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return {
        status: "error",
        message: "Ese usuario o correo ya está registrado.",
      };
    }

    if (userId) {
      await getPool().execute(
        `DELETE FROM users
         WHERE id = :userId
           AND role = 'independent'
           AND email_verified_at IS NULL`,
        { userId },
      );
    }

    throw error;
  }
}

export async function resendEmailVerificationAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await ensureRuntimeSchema();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const genericMessage =
    "Si existe una cuenta pendiente con ese correo, recibirás un nuevo enlace de verificación.";

  if (!isValidEmail(email)) {
    return { status: "success", message: genericMessage };
  }

  const user = await queryOne<RowDataPacket & { id: number }>(
    `SELECT id
     FROM users
     WHERE email = :email
       AND is_active = 1
       AND email_verified_at IS NULL
     LIMIT 1`,
    { email },
  );

  if (user && isSmtpConfigured() && canEncryptEmailQueue()) {
    try {
      await sendEmailVerification(user.id);
    } catch {
      // Keep the response generic so account existence and mail state remain private.
    }
  }

  return { status: "success", message: genericMessage };
}

export async function verifyEmailAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await ensureRuntimeSchema();
  const token = String(formData.get("token") ?? "");
  const verified = await verifyEmailToken(token);

  if (!verified) {
    return {
      status: "error",
      message: "El enlace venció, ya fue usado o no es válido.",
    };
  }

  redirect("/login?email=verified");
}

export async function changePasswordAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await requireUserAllowingPasswordChange();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  const passwordError = getPasswordPolicyError(newPassword);

  if (!currentPassword || !newPassword) {
    return { status: "error", message: "Completa todos los campos." };
  }

  if (passwordError) {
    return { status: "error", message: passwordError };
  }

  if (newPassword !== passwordConfirmation) {
    return { status: "error", message: "Las contraseñas no coinciden." };
  }

  const passwordUser = await queryOne<PasswordUserRow>(
    "SELECT id, password_hash FROM users WHERE id = :id LIMIT 1",
    { id: user.id },
  );

  if (
    !passwordUser ||
    !(await verifyPassword(currentPassword, passwordUser.password_hash))
  ) {
    return { status: "error", message: "La contraseña actual no es correcta." };
  }

  if (await verifyPassword(newPassword, passwordUser.password_hash)) {
    return {
      status: "error",
      message: "La contraseña nueva debe ser diferente a la actual.",
    };
  }

  await getPool().execute(
    `UPDATE users
     SET password_hash = :passwordHash, must_change_password = 0
     WHERE id = :id`,
    { id: user.id, passwordHash: await hashPassword(newPassword) },
  );
  await destroyAllUserSessions(user.id);
  await createSession(user.id);

  redirect(user.role === "admin" || user.role === "teacher" ? "/admin" : "/");
}

export async function forgotPasswordAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await ensureRuntimeSchema();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const genericMessage =
    "Si existe una cuenta activa con ese correo, recibirás un enlace para cambiar la contraseña.";

  if (!isValidEmail(email)) {
    return { status: "success", message: genericMessage };
  }

  const user = await queryOne<ResetUserRow>(
    `SELECT id, email, full_name
     FROM users
     WHERE email = :email
       AND is_active = 1
       AND email_verified_at IS NOT NULL
     LIMIT 1`,
    { email },
  );

  if (!user) {
    return { status: "success", message: genericMessage };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.query("SELECT id FROM users WHERE id = :userId FOR UPDATE", {
      userId: user.id,
    });
    const [recentTokens] = await connection.query<RowDataPacket[]>(
      `SELECT id
       FROM password_reset_tokens
       WHERE user_id = :userId
         AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
       LIMIT 1`,
      { userId: user.id },
    );

    if (recentTokens.length) {
      await connection.rollback();
      return { status: "success", message: genericMessage };
    }

    await connection.execute(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = :userId AND used_at IS NULL`,
      { userId: user.id },
    );
    await connection.execute(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (:userId, :tokenHash, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
      { userId: user.id, tokenHash },
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  try {
    const outboxId = await queuePasswordResetEmail({
      email: user.email,
      fullName: user.full_name,
      resetUrl: `${getApplicationUrl()}/reset-password?token=${encodeURIComponent(token)}`,
      userId: user.id,
    });
    await deliverPendingEmails(1, [outboxId]);
  } catch {
    // The public response stays generic so it does not disclose accounts or mail configuration.
  }

  return { status: "success", message: genericMessage };
}

export async function resetPasswordAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await ensureRuntimeSchema();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  const passwordError = getPasswordPolicyError(password);

  if (!token || token.length > 200) {
    return { status: "error", message: "El enlace no es válido." };
  }

  if (passwordError) {
    return { status: "error", message: passwordError };
  }

  if (password !== passwordConfirmation) {
    return { status: "error", message: "Las contraseñas no coinciden." };
  }

  const connection = await getPool().getConnection();
  let userId: number | null = null;

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<ResetTokenRow[]>(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = :tokenHash
         AND used_at IS NULL
         AND expires_at > NOW()
       LIMIT 1 FOR UPDATE`,
      { tokenHash: hashToken(token) },
    );
    const resetToken = rows[0];

    if (!resetToken) {
      await connection.rollback();
      return {
        status: "error",
        message: "El enlace ya fue usado, venció o no es válido.",
      };
    }

    userId = resetToken.user_id;
    await connection.execute(
      `UPDATE users
       SET password_hash = :passwordHash, must_change_password = 0
       WHERE id = :userId`,
      { userId, passwordHash: await hashPassword(password) },
    );
    await connection.execute(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = :id",
      { id: resetToken.id },
    );
    await connection.execute(
      "DELETE FROM user_sessions WHERE user_id = :userId",
      { userId },
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (!userId) {
    return { status: "error", message: "No se pudo cambiar la contraseña." };
  }

  redirect("/login?password=changed");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isDuplicateEntry(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY"
  );
}
