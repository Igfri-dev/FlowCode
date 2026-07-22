import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";

async function main() {
  const [{ getPool }, { hashPassword }, { ensureRuntimeSchema }] =
    await Promise.all([
      import("../src/lib/db"),
      import("../src/lib/password"),
      import("../src/lib/schema"),
    ]);
  await ensureRuntimeSchema();
  const pool = getPool();
  const prefix = `usergroups${Date.now()}`;
  const organizationIds: number[] = [];
  const userIds: number[] = [];

  async function createSessionCookie(userId: number) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await pool.execute(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES (:userId, :tokenHash, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      { userId, tokenHash },
    );
    return `flowcode_session=${token}`;
  }

  try {
    for (const suffix of ["a", "b"]) {
      const [result] = await pool.execute(
        "INSERT INTO organizations (name, slug) VALUES (:name, :slug)",
        { name: `${prefix}-${suffix}`, slug: `${prefix}-${suffix}` },
      );
      organizationIds.push(Number((result as { insertId: number }).insertId));
    }

    const passwordHash = await hashPassword("secure123");
    const accountDefinitions = [
      { role: "admin", organizationId: null, suffix: "admin" },
      { role: "teacher", organizationId: organizationIds[0], suffix: "teacher-a" },
      { role: "student", organizationId: organizationIds[0], suffix: "student-a" },
      { role: "student", organizationId: organizationIds[1], suffix: "student-b" },
    ];

    for (const account of accountDefinitions) {
      const [result] = await pool.execute(
        `INSERT INTO users
           (organization_id, username, email, email_verified_at, password_hash,
            full_name, role, must_change_password)
         VALUES
           (:organizationId, :username, :email, NOW(), :passwordHash,
            :fullName, :role, 0)`,
        {
          organizationId: account.organizationId,
          username: `${prefix}-${account.suffix}`,
          email: `${prefix}-${account.suffix}@example.com`,
          passwordHash,
          fullName: `${prefix}-${account.suffix}`,
          role: account.role,
        },
      );
      userIds.push(Number((result as { insertId: number }).insertId));
    }

    const groupDefinitions = [
      { name: `${prefix}-group-a`, organizationId: organizationIds[0] },
      { name: `${prefix}-group-b`, organizationId: organizationIds[1] },
      { name: `${prefix}-group-global`, organizationId: null },
    ];

    for (const [index, group] of groupDefinitions.entries()) {
      const [result] = await pool.execute(
        `INSERT INTO user_groups (organization_id, name, group_type)
         VALUES (:organizationId, :name, 'custom')`,
        group,
      );
      await pool.execute(
        `INSERT INTO user_group_members (group_id, user_id)
         VALUES (:groupId, :userId)`,
        {
          groupId: Number((result as { insertId: number }).insertId),
          userId: index === 0 ? userIds[2] : index === 1 ? userIds[3] : userIds[0],
        },
      );
    }

    const adminCookie = await createSessionCookie(userIds[0]);
    const teacherCookie = await createSessionCookie(userIds[1]);
    const [adminResponse, teacherResponse] = await Promise.all([
      fetch(`${baseUrl}/admin/users`, { headers: { Cookie: adminCookie } }),
      fetch(`${baseUrl}/admin/users`, { headers: { Cookie: teacherCookie } }),
    ]);
    assert.equal(adminResponse.status, 200);
    assert.equal(teacherResponse.status, 200);
    const [adminHtml, teacherHtml] = await Promise.all([
      adminResponse.text(),
      teacherResponse.text(),
    ]);
    assert.ok(adminHtml.includes(`${prefix}-group-a`));
    assert.ok(adminHtml.includes(`${prefix}-group-b`));
    assert.ok(adminHtml.includes(`${prefix}-group-global`));
    assert.ok(teacherHtml.includes(`${prefix}-group-a`));
    assert.ok(teacherHtml.includes(`${prefix}-student-a`));
    assert.ok(!teacherHtml.includes(`${prefix}-group-b`));
    assert.ok(!teacherHtml.includes(`${prefix}-group-global`));
    assert.ok(!teacherHtml.includes(`${prefix}-student-b`));

    await pool.execute("DELETE FROM users WHERE id = :userId", {
      userId: userIds[2],
    });
    const [memberships] = await pool.query<
      ({ count: number } & import("mysql2/promise").RowDataPacket)[]
    >(
      `SELECT COUNT(*) AS count
       FROM user_group_members member
       INNER JOIN user_groups user_group ON user_group.id = member.group_id
       WHERE user_group.name = :name`,
      { name: `${prefix}-group-a` },
    );
    assert.equal(Number(memberships[0]?.count), 0);

    console.log("User group integration checks passed.");
  } finally {
    if (userIds.length > 0) {
      await pool.query("DELETE FROM email_outbox WHERE user_id IN (?)", [userIds]);
      await pool.query("DELETE FROM users WHERE id IN (?)", [userIds]);
    }
    if (organizationIds.length > 0) {
      await pool.query("DELETE FROM organizations WHERE id IN (?)", [organizationIds]);
    }
    await pool.execute("DELETE FROM user_groups WHERE name LIKE :prefix", {
      prefix: `${prefix}%`,
    });
    await pool.end();
  }
}

void main();
