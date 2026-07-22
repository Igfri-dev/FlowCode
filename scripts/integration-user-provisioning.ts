import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import type { RowDataPacket } from "mysql2/promise";

loadEnvConfig(process.cwd());

async function main() {
  const [
    { getPool },
    { hashPassword },
    { ensureRuntimeSchema },
    provisioning,
    emailVerification,
  ] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/password"),
    import("../src/lib/schema"),
    import("../src/lib/user-provisioning"),
    import("../src/lib/email-verification"),
  ]);
  await ensureRuntimeSchema();
  const pool = getPool();
  const prefix = `flowcodetest${Date.now()}`;
  const organizationIds: number[] = [];

  try {
    for (const suffix of ["a", "b"]) {
      const [result] = await pool.execute(
        "INSERT INTO organizations (name, slug) VALUES (:name, :slug)",
        { name: `${prefix}-${suffix}`, slug: `${prefix}-${suffix}` },
      );
      organizationIds.push(Number((result as { insertId: number }).insertId));
    }
    const [groupResult] = await pool.execute(
      `INSERT INTO user_groups (organization_id, name, group_type)
       VALUES (:organizationId, :name, 'organization')`,
      { organizationId: organizationIds[0], name: `${prefix}-organization` },
    );
    const organizationGroupId = Number(
      (groupResult as { insertId: number }).insertId,
    );

    const admin = {
      id: 0,
      username: "integration-admin",
      fullName: "Integration Admin",
      email: null,
      emailVerified: false,
      role: "admin" as const,
      mustChangePassword: false,
      organizationId: null,
      organizationName: null,
    };
    const first = await provisioning.provisionUsers({
      creator: admin,
      users: [
        {
          fullName: "Student 0",
          username: `${prefix}student0`,
          email: `${prefix}student0@example.com`,
          password: "secure123",
          role: "student",
          organizationId: organizationIds[0],
        },
      ],
    });
    assert.equal(first.created, 1);

    const [createdRows] = await pool.query<
      (RowDataPacket & { id: number; must_change_password: number; queued: number })[]
    >(
      `SELECT u.id, u.must_change_password,
              (SELECT COUNT(*) FROM email_outbox o WHERE o.user_id = u.id) AS queued
       FROM users u WHERE u.username = :username`,
      { username: `${prefix}student0` },
    );
    assert.equal(createdRows[0]?.must_change_password, 1);
    assert.equal(Number(createdRows[0]?.queued), 1);
    const [membershipRows] = await pool.query<
      (RowDataPacket & { count: number })[]
    >(
      `SELECT COUNT(*) AS count
       FROM user_group_members
       WHERE group_id = :groupId AND user_id = :userId`,
      { groupId: organizationGroupId, userId: createdRows[0].id },
    );
    assert.equal(Number(membershipRows[0]?.count), 1);

    const verification = await emailVerification.issueEmailVerificationToken(
      createdRows[0].id,
      { ignoreCooldown: true },
    );
    assert.equal(verification.status, "issued");
    if (verification.status !== "issued") {
      throw new Error("Expected an email verification token.");
    }
    assert.ok(await emailVerification.verifyEmailToken(verification.token));
    assert.equal(
      await emailVerification.verifyEmailToken(verification.token),
      null,
    );
    const [verifiedRows] = await pool.query<
      (RowDataPacket & { verified: number })[]
    >(
      "SELECT email_verified_at IS NOT NULL AS verified FROM users WHERE id = :id",
      { id: createdRows[0].id },
    );
    assert.equal(Number(verifiedRows[0]?.verified), 1);

    const teacher = {
      ...admin,
      role: "teacher" as const,
      organizationId: organizationIds[0],
      organizationName: `${prefix}-a`,
    };
    await assert.rejects(
      provisioning.provisionUsers({
        creator: teacher,
        users: [
          {
            fullName: "Foreign student",
            username: `${prefix}foreign`,
            email: `${prefix}foreign@example.com`,
            password: "secure123",
            role: "student",
            organizationReference: `${prefix}-b`,
          },
        ],
      }),
      /organización debe ser/,
    );

    const sharedHash = await hashPassword("secure123");
    for (let index = 1; index < 60; index += 1) {
      await pool.execute(
        `INSERT INTO users
           (organization_id, username, email, password_hash, full_name, role, must_change_password)
         VALUES (:organizationId, :username, :email, :passwordHash, :fullName, 'student', 1)`,
        {
          organizationId: organizationIds[0],
          username: `${prefix}student${index}`,
          email: `${prefix}student${index}@example.com`,
          passwordHash: sharedHash,
          fullName: `Student ${index}`,
        },
      );
    }

    await assert.rejects(
      provisioning.provisionUsers({
        creator: admin,
        users: [
          {
            fullName: "Student 61",
            username: `${prefix}student61`,
            email: `${prefix}student61@example.com`,
            password: "secure123",
            role: "student",
            organizationId: organizationIds[0],
          },
        ],
      }),
      /máximo de 60 estudiantes/,
    );

    console.log("User provisioning integration checks passed.");
  } finally {
    const [testUsers] = await pool.query<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM users WHERE username LIKE :usernamePrefix",
      { usernamePrefix: `${prefix}%` },
    );
    const userIds = testUsers.map((row) => row.id);
    if (userIds.length) {
      await pool.query("DELETE FROM email_outbox WHERE user_id IN (?)", [userIds]);
      await pool.query("DELETE FROM users WHERE id IN (?)", [userIds]);
    }
    if (organizationIds.length) {
      await pool.query("DELETE FROM organizations WHERE id IN (?)", [organizationIds]);
    }
    await pool.end();
  }
}

void main();
