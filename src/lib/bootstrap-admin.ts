import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { getPool, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getPasswordPolicyError } from "@/lib/password-policy";

export async function ensureBootstrapAdmin({ required = false } = {}) {
  // Bootstrap only an empty installation; never reset or promote an existing user.
  if (await queryOne<RowDataPacket>("SELECT id FROM users LIMIT 1")) {
    return null;
  }

  const username = process.env.FLOWCODE_BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = process.env.FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD;

  if (!username || !password) {
    if (required) {
      throw new Error(
        "Set FLOWCODE_BOOTSTRAP_ADMIN_USERNAME and FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD in .env.local before running npm run db:setup.",
      );
    }
    return null;
  }

  if (username.length > 80) {
    throw new Error(
      "FLOWCODE_BOOTSTRAP_ADMIN_USERNAME must contain at most 80 characters.",
    );
  }
  if (getPasswordPolicyError(password)) {
    throw new Error(
      "FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD must contain at least 8 characters and a number.",
    );
  }

  const connection = await getPool().getConnection();
  // The lock is scoped to this database and shared by setup and first-login bootstrap.
  const lockName = `flowcode:bootstrap:${createHash("sha256")
    .update(process.env.MYSQL_DATABASE ?? "flowcode")
    .digest("hex")
    .slice(0, 40)}`;
  let locked = false;

  try {
    const [locks] = await connection.query<
      (RowDataPacket & { acquired: number })[]
    >("SELECT GET_LOCK(?, 10) AS acquired", [lockName]);
    locked = locks[0]?.acquired === 1;
    if (!locked)
      throw new Error(
        "Could not acquire the administrator setup lock. Retry setup.",
      );

    const [users] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM users LIMIT 1",
    );
    if (users.length) return null;

    await connection.execute(
      `INSERT INTO users (username, password_hash, full_name, role, must_change_password)
       VALUES (?, ?, 'Administrator', 'admin', 1)`,
      [username, await hashPassword(password)],
    );
    return username;
  } finally {
    try {
      if (locked) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
    } finally {
      connection.release();
    }
  }
}
