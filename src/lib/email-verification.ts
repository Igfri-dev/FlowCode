import { createHash, randomBytes } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { UserRole } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  deliverPendingEmails,
  getApplicationUrl,
  queueEmailVerificationEmail,
} from "@/lib/email";

type VerificationUserRow = RowDataPacket & {
  id: number;
  email: string | null;
  email_verified_at: Date | null;
  full_name: string;
  role: UserRole;
};

type VerificationTokenRow = RowDataPacket & {
  id: number;
  user_id: number;
  role: UserRole;
};

export type VerificationIssueResult =
  | { status: "already_verified" | "cooldown" }
  | {
      status: "issued";
      token: string;
      userId: number;
      email: string;
      fullName: string;
    };

export async function issueEmailVerificationToken(
  userId: number,
  options: { ignoreCooldown?: boolean } = {},
): Promise<VerificationIssueResult> {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const user = await getVerificationUser(connection, userId);

    if (!user?.email) {
      throw new Error("La cuenta no tiene un correo válido.");
    }

    if (user.email_verified_at) {
      await connection.rollback();
      return { status: "already_verified" };
    }

    if (!options.ignoreCooldown) {
      const [recentTokens] = await connection.query<RowDataPacket[]>(
        `SELECT id
         FROM email_verification_tokens
         WHERE user_id = :userId
           AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
         LIMIT 1`,
        { userId },
      );

      if (recentTokens.length) {
        await connection.rollback();
        return { status: "cooldown" };
      }
    }

    const token = randomBytes(32).toString("hex");
    await connection.execute(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE user_id = :userId AND used_at IS NULL`,
      { userId },
    );
    await connection.execute(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES (:userId, :tokenHash, DATE_ADD(NOW(), INTERVAL 48 HOUR))`,
      { userId, tokenHash: hashToken(token) },
    );
    await connection.commit();

    return {
      status: "issued",
      token,
      userId,
      email: user.email,
      fullName: user.full_name,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function sendEmailVerification(
  userId: number,
  options: { ignoreCooldown?: boolean } = {},
) {
  const issue = await issueEmailVerificationToken(userId, options);

  if (issue.status !== "issued") {
    return issue;
  }

  const outboxId = await queueEmailVerificationEmail({
    email: issue.email,
    fullName: issue.fullName,
    userId: issue.userId,
    verificationUrl: createEmailVerificationUrl(issue.token),
  });
  const delivery = await deliverPendingEmails(1, [outboxId]);

  return { ...issue, outboxId, delivery };
}

export async function verifyEmailToken(token: string) {
  if (!token || token.length > 200) {
    return null;
  }

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<VerificationTokenRow[]>(
      `SELECT token.id, token.user_id, user.role
       FROM email_verification_tokens token
       INNER JOIN users user ON user.id = token.user_id
       WHERE token.token_hash = :tokenHash
         AND token.used_at IS NULL
         AND token.expires_at > NOW()
       LIMIT 1 FOR UPDATE`,
      { tokenHash: hashToken(token) },
    );
    const verificationToken = rows[0];

    if (!verificationToken) {
      await connection.rollback();
      return null;
    }

    await connection.execute(
      `UPDATE users
       SET email_verified_at = NOW()
       WHERE id = :userId`,
      { userId: verificationToken.user_id },
    );
    await connection.execute(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE user_id = :userId AND used_at IS NULL`,
      { userId: verificationToken.user_id },
    );
    await connection.commit();

    return {
      userId: verificationToken.user_id,
      role: verificationToken.role,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export function createEmailVerificationUrl(token: string) {
  return `${getApplicationUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

async function getVerificationUser(
  connection: PoolConnection,
  userId: number,
) {
  const [rows] = await connection.query<VerificationUserRow[]>(
    `SELECT id, email, email_verified_at, full_name, role
     FROM users
     WHERE id = :userId
     LIMIT 1 FOR UPDATE`,
    { userId },
  );

  return rows[0] ?? null;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

