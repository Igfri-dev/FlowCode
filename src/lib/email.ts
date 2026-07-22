import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import nodemailer from "nodemailer";
import type { RowDataPacket } from "mysql2/promise";
import { getPool, queryRows } from "@/lib/db";

type EmailMessage = {
  subject: string;
  text: string;
  html: string;
};

type OutboxRow = RowDataPacket & {
  id: number;
  recipient: string;
  payload_encrypted: string;
  attempts: number;
  claim_token: string;
};

export type EmailDeliverySummary = {
  sent: number;
  failed: number;
  pending: number;
  configured: boolean;
};

export function canEncryptEmailQueue() {
  return getQueueSecrets().length > 0;
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export function getApplicationUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function queueWelcomeEmail({
  email,
  fullName,
  password,
  passwordWasGenerated,
  userId,
  username,
  verificationUrl,
}: {
  email: string;
  fullName: string;
  password: string;
  passwordWasGenerated: boolean;
  userId: number;
  username: string;
  verificationUrl: string;
}) {
  const message = createWelcomeMessage({
    fullName,
    password,
    passwordWasGenerated,
    username,
    verificationUrl,
  });

  return queueEmail({
    message,
    messageType: "welcome",
    recipient: email,
    userId,
  });
}

export async function queueEmailVerificationEmail({
  email,
  fullName,
  userId,
  verificationUrl,
}: {
  email: string;
  fullName: string;
  userId: number;
  verificationUrl: string;
}) {
  return queueEmail({
    message: createEmailVerificationMessage({ fullName, verificationUrl }),
    messageType: "email_verification",
    recipient: email,
    userId,
  });
}

export async function queuePasswordResetEmail({
  email,
  fullName,
  resetUrl,
  userId,
}: {
  email: string;
  fullName: string;
  resetUrl: string;
  userId: number;
}) {
  return queueEmail({
    message: createPasswordResetMessage({ fullName, resetUrl }),
    messageType: "password_reset",
    recipient: email,
    userId,
  });
}

export async function deliverPendingEmails(
  maximum = 25,
  onlyIds: number[] = [],
): Promise<EmailDeliverySummary> {
  const safeIds = onlyIds.filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  const idCondition = safeIds.length ? ` AND id IN (${safeIds.join(",")})` : "";

  if (!isSmtpConfigured()) {
    const pendingRows = await queryRows<RowDataPacket & { count: number }>(
      `SELECT COUNT(*) AS count
       FROM email_outbox
       WHERE status IN ('pending', 'processing', 'failed')
         AND attempts < 5${idCondition}`,
    );

    return {
      sent: 0,
      failed: 0,
      pending: Number(pendingRows[0]?.count ?? 0),
      configured: false,
    };
  }

  const limit = Math.max(1, Math.min(100, Math.floor(maximum)));
  const rows = await claimPendingEmails(limit, idCondition);

  if (!rows.length) {
    return {
      sent: 0,
      failed: 0,
      pending: await countPendingEmails(idCondition),
      configured: true,
    };
  }

  const transporter = createSmtpTransport();
  let sent = 0;
  let failed = 0;

  try {
    for (const row of rows) {
      try {
        const message = decryptMessage(row.payload_encrypted);
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: row.recipient,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        await getPool().execute(
          `UPDATE email_outbox
           SET status = 'sent', attempts = attempts + 1,
               claim_token = NULL, claimed_at = NULL,
               last_error = NULL, sent_at = NOW()
           WHERE id = :id AND claim_token = :claimToken`,
          { id: row.id, claimToken: row.claim_token },
        );
        sent += 1;
      } catch (error) {
        await getPool().execute(
          `UPDATE email_outbox
           SET status = 'failed', attempts = attempts + 1,
               claim_token = NULL, claimed_at = NULL,
               last_error = :lastError
           WHERE id = :id AND claim_token = :claimToken`,
          {
            id: row.id,
            claimToken: row.claim_token,
            lastError: getSafeEmailError(error),
          },
        );
        failed += 1;
      }
    }
  } finally {
    transporter.close();
  }

  return {
    sent,
    failed,
    pending: await countPendingEmails(idCondition),
    configured: true,
  };
}

async function countPendingEmails(idCondition: string) {
  const pendingRows = await queryRows<RowDataPacket & { count: number }>(
    `SELECT COUNT(*) AS count
     FROM email_outbox
     WHERE status IN ('pending', 'processing', 'failed')
       AND attempts < 5${idCondition}`,
  );

  return Number(pendingRows[0]?.count ?? 0);
}

async function claimPendingEmails(limit: number, idCondition: string) {
  const claimToken = randomUUID();
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE email_outbox
       SET status = 'failed', claim_token = NULL, claimed_at = NULL,
           last_error = 'El intento anterior no finalizó; se reintentará.'
       WHERE status = 'processing'
         AND claimed_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
    );
    await connection.execute(
      `UPDATE email_outbox
       SET status = 'processing', claim_token = :claimToken, claimed_at = NOW()
       WHERE status IN ('pending', 'failed')
         AND attempts < 5${idCondition}
       ORDER BY created_at, id
       LIMIT ${limit}`,
      { claimToken },
    );
    const [rows] = await connection.query<OutboxRow[]>(
      `SELECT id, recipient, payload_encrypted, attempts, claim_token
       FROM email_outbox
       WHERE claim_token = :claimToken
       ORDER BY created_at, id`,
      { claimToken },
    );
    await connection.commit();

    return rows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function queueEmail({
  message,
  messageType,
  recipient,
  userId,
}: {
  message: EmailMessage;
  messageType: "welcome" | "password_reset" | "email_verification";
  recipient: string;
  userId: number;
}) {
  const [result] = await getPool().execute(
    `INSERT INTO email_outbox
       (user_id, recipient, message_type, payload_encrypted)
     VALUES (:userId, :recipient, :messageType, :payloadEncrypted)`,
    {
      userId,
      recipient,
      messageType,
      payloadEncrypted: encryptMessage(message),
    },
  );

  return Number((result as { insertId: number }).insertId);
}

function createSmtpTransport() {
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  return nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure:
      process.env.SMTP_SECURE === "true" ||
      (process.env.SMTP_SECURE !== "false" && smtpPort === 465),
    auth:
      smtpUser && smtpPassword
        ? { user: smtpUser, pass: smtpPassword }
        : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

function getQueueSecrets() {
  return Array.from(
    new Set(
      [
        process.env.EMAIL_QUEUE_SECRET,
        process.env.SMTP_PASSWORD,
        process.env.FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD,
      ].filter((secret): secret is string => Boolean(secret)),
    ),
  );
}

function getEncryptionKey(secret?: string) {
  const selectedSecret = secret ?? getQueueSecrets()[0];

  if (!selectedSecret) {
    throw new Error(
      "Configura EMAIL_QUEUE_SECRET para cifrar los correos pendientes.",
    );
  }

  return createHash("sha256").update(selectedSecret).digest();
}

function encryptMessage(message: EmailMessage) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    initializationVector,
  );
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(message), "utf8"),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return [
    "v1",
    initializationVector.toString("base64url"),
    authenticationTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function decryptMessage(value: string): EmailMessage {
  const [version, vector, tag, encrypted] = value.split(":");

  if (version !== "v1" || !vector || !tag || !encrypted) {
    throw new Error("El correo pendiente tiene un formato inválido.");
  }

  for (const secret of getQueueSecrets()) {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        getEncryptionKey(secret),
        Buffer.from(vector, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const plainText = Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64url")),
        decipher.final(),
      ]).toString("utf8");

      return JSON.parse(plainText) as EmailMessage;
    } catch {
      // Try legacy fallback keys so adding EMAIL_QUEUE_SECRET does not orphan queued mail.
    }
  }

  throw new Error("No se pudo descifrar el correo pendiente con las claves configuradas.");
}

function createWelcomeMessage({
  fullName,
  password,
  passwordWasGenerated,
  username,
  verificationUrl,
}: {
  fullName: string;
  password: string;
  passwordWasGenerated: boolean;
  username: string;
  verificationUrl: string;
}): EmailMessage {
  const safeName = escapeHtml(fullName);
  const safeUsername = escapeHtml(username);
  const safePassword = escapeHtml(password);
  const passwordExplanation = passwordWasGenerated
    ? "El servidor generó una contraseña temporal para tu cuenta."
    : "La persona que creó tu cuenta definió esta contraseña inicial.";
  const plainPasswordExplanation = passwordWasGenerated
    ? "El servidor generó una contraseña temporal para tu cuenta."
    : "La persona que creó tu cuenta definió esta contraseña inicial.";

  return {
    subject: "Tu cuenta de FlowCode está lista",
    text: [
      `Hola ${fullName},`,
      "",
      "Tu cuenta de FlowCode ha sido creada.",
      `Usuario: ${username}`,
      `Contraseña inicial: ${password}`,
      plainPasswordExplanation,
      "",
      `Verifica tu correo durante las próximas 48 horas: ${verificationUrl}`,
      "Al iniciar sesión por primera vez tendrás que elegir una contraseña nueva de al menos 8 caracteres y con al menos un número.",
      `Inicia sesión en ${getApplicationUrl()}/login`,
    ].join("\n"),
    html: emailShell({
      eyebrow: "Cuenta creada",
      title: `Bienvenido a FlowCode, ${safeName}`,
      body: `
        <p style="margin:0 0 18px;color:#404040;line-height:1.65">Tu cuenta ya está disponible. ${passwordExplanation}</p>
        <div style="border:1px solid #d4d4d4;border-radius:10px;background:#fafafa;padding:18px;margin:0 0 18px">
          <p style="margin:0 0 8px;color:#737373;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Usuario</p>
          <p style="margin:0 0 16px;color:#171717;font-size:17px;font-weight:700">${safeUsername}</p>
          <p style="margin:0 0 8px;color:#737373;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Contraseña inicial</p>
          <p style="margin:0;color:#171717;font-family:monospace;font-size:17px;font-weight:700">${safePassword}</p>
        </div>
        <p style="margin:0 0 12px;color:#404040;line-height:1.65"><strong>Confirma que este correo te pertenece.</strong> El enlace estará disponible durante 48 horas.</p>
        ${emailButton("Verificar correo", verificationUrl)}
        <p style="margin:0 0 20px;color:#404040;line-height:1.65"><strong>Por seguridad, deberás cambiarla en tu primer inicio de sesión.</strong> La nueva contraseña debe tener al menos 8 caracteres y un número.</p>
        ${emailButton("Iniciar sesión", `${getApplicationUrl()}/login`)}
      `,
    }),
  };
}

function createEmailVerificationMessage({
  fullName,
  verificationUrl,
}: {
  fullName: string;
  verificationUrl: string;
}): EmailMessage {
  const safeName = escapeHtml(fullName);

  return {
    subject: "Verifica tu correo de FlowCode",
    text: [
      `Hola ${fullName},`,
      "",
      "Confirma tu correo para activar tu cuenta personal de FlowCode.",
      `El enlace es válido durante 48 horas: ${verificationUrl}`,
      "",
      "Si no creaste esta cuenta, puedes ignorar este correo.",
    ].join("\n"),
    html: emailShell({
      eyebrow: "Verificación de correo",
      title: `Confirma tu cuenta, ${safeName}`,
      body: `
        <p style="margin:0 0 18px;color:#404040;line-height:1.65">Confirma que este correo te pertenece para activar tu espacio personal. El enlace es válido durante 48 horas y solo puede usarse una vez.</p>
        ${emailButton("Verificar mi correo", verificationUrl)}
        <p style="margin:20px 0 0;color:#737373;font-size:13px;line-height:1.55">Si no creaste esta cuenta, puedes ignorar este correo.</p>
      `,
    }),
  };
}

function createPasswordResetMessage({
  fullName,
  resetUrl,
}: {
  fullName: string;
  resetUrl: string;
}): EmailMessage {
  const safeName = escapeHtml(fullName);

  return {
    subject: "Restablece tu contraseña de FlowCode",
    text: [
      `Hola ${fullName},`,
      "",
      "Recibimos una solicitud para restablecer tu contraseña.",
      `Abre este enlace durante la próxima hora: ${resetUrl}`,
      "",
      "Si no solicitaste este cambio, puedes ignorar este correo.",
    ].join("\n"),
    html: emailShell({
      eyebrow: "Seguridad",
      title: `Restablece tu contraseña, ${safeName}`,
      body: `
        <p style="margin:0 0 18px;color:#404040;line-height:1.65">Recibimos una solicitud para cambiar tu contraseña. El enlace es válido durante una hora y solo puede usarse una vez.</p>
        ${emailButton("Elegir una contraseña nueva", resetUrl)}
        <p style="margin:20px 0 0;color:#737373;font-size:13px;line-height:1.55">Si no solicitaste este cambio, puedes ignorar este correo.</p>
      `,
    }),
  };
}

function emailShell({
  body,
  eyebrow,
  title,
}: {
  body: string;
  eyebrow: string;
  title: string;
}) {
  return `<!doctype html>
  <html lang="es"><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#171717">
    <div style="padding:32px 16px">
      <div style="max-width:600px;margin:0 auto;border:1px solid #d4d4d4;border-radius:14px;background:#ffffff;overflow:hidden">
        <div style="background:#0a0a0a;padding:24px 28px;color:#ffffff">
          <p style="margin:0 0 6px;color:#6ee7b7;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em">${escapeHtml(eyebrow)}</p>
          <h1 style="margin:0;font-size:25px;line-height:1.25">${title}</h1>
        </div>
        <div style="padding:28px">${body}</div>
        <div style="border-top:1px solid #e5e5e5;padding:18px 28px;color:#737373;font-size:12px">FlowCode · Editor visual de algoritmos</div>
      </div>
    </div>
  </body></html>`;
}

function emailButton(label: string, url: string) {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;border-radius:8px;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px">${escapeHtml(label)}</a>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };

    return entities[character];
  });
}

function getSafeEmailError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error SMTP desconocido";

  return message.replace(/[\r\n]+/g, " ").slice(0, 1000);
}
