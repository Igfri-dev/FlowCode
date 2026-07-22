import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import type { RowDataPacket } from "mysql2/promise";

loadEnvConfig(process.cwd());

const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";

async function main() {
  const [
    { getPool },
    { hashPassword },
    { ensureRuntimeSchema },
    exerciseData,
    adminData,
    { getExercises },
  ] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/password"),
    import("../src/lib/schema"),
    import("../src/lib/exercise-data"),
    import("../src/lib/admin-data"),
    import("../src/features/exercises/data/exercises"),
  ]);
  await ensureRuntimeSchema();
  const pool = getPool();
  const prefix = `exercisescope${Date.now()}`;
  const organizationIds: number[] = [];
  const exerciseIds: number[] = [];
  const userIds: number[] = [];
  const sessionHashes: string[] = [];

  async function createSessionCookie(userId: number) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await pool.execute(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES (:userId, :tokenHash, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      { userId, tokenHash },
    );
    sessionHashes.push(tokenHash);
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
    const [studentResult] = await pool.execute(
      `INSERT INTO users
         (organization_id, username, email, email_verified_at, password_hash,
          full_name, role, must_change_password)
       VALUES
         (:organizationId, :username, :email, NOW(), :passwordHash,
          'Scope Student', 'student', 0)`,
      {
        organizationId: organizationIds[0],
        username: `${prefix}-student`,
        email: `${prefix}-student@example.com`,
        passwordHash,
      },
    );
    const studentId = Number((studentResult as { insertId: number }).insertId);
    userIds.push(studentId);
    const staffIds: number[] = [];
    for (const staff of [
      { role: "admin", organizationId: null, suffix: "admin" },
      { role: "teacher", organizationId: organizationIds[0], suffix: "teacher" },
    ]) {
      const [result] = await pool.execute(
        `INSERT INTO users
           (organization_id, username, email, email_verified_at, password_hash,
            full_name, role, must_change_password)
         VALUES
           (:organizationId, :username, :email, NOW(), :passwordHash,
            :fullName, :role, 0)`,
        {
          organizationId: staff.organizationId,
          username: `${prefix}-${staff.suffix}`,
          email: `${prefix}-${staff.suffix}@example.com`,
          passwordHash,
          fullName: `Scope ${staff.suffix}`,
          role: staff.role,
        },
      );
      const staffId = Number((result as { insertId: number }).insertId);
      staffIds.push(staffId);
      userIds.push(staffId);
    }

    for (const exercise of [
      { organizationId: null, title: "Global scope exercise" },
      { organizationId: organizationIds[0], title: "Organization A exercise" },
      { organizationId: organizationIds[1], title: "Organization B exercise" },
    ]) {
      const [result] = await pool.execute(
        `INSERT INTO exercises
           (organization_id, slug, title, description, objective, difficulty,
            test_cases, is_active)
         VALUES
           (:organizationId, :slug, :title, 'Description', 'Objective', 'facil',
            :testCases, 1)`,
        {
          organizationId: exercise.organizationId,
          slug: `${prefix}-${exerciseIds.length}`,
          title: exercise.title,
          testCases: JSON.stringify([{ name: "empty", expectedOutputs: [] }]),
        },
      );
      exerciseIds.push(Number((result as { insertId: number }).insertId));
    }

    const organizationAExercises = await exerciseData.listDatabaseExercises(
      organizationIds[0],
    );
    const organizationBExercises = await exerciseData.listDatabaseExercises(
      organizationIds[1],
    );
    assert.deepEqual(
      organizationAExercises.map((exercise) => exercise.title).sort(),
      ["Global scope exercise", "Organization A exercise"],
    );
    assert.deepEqual(
      organizationBExercises.map((exercise) => exercise.title).sort(),
      ["Global scope exercise", "Organization B exercise"],
    );

    const teacherA = {
      id: 0,
      username: "scope-teacher",
      fullName: "Scope Teacher",
      email: null,
      emailVerified: false,
      role: "teacher" as const,
      mustChangePassword: false,
      organizationId: organizationIds[0],
      organizationName: `${prefix}-a`,
    };
    const teacherCatalog = await adminData.listAdminExercises(teacherA);
    assert.equal(
      teacherCatalog.filter((exercise) => exercise.isBuiltIn).length,
      getExercises("es").length,
    );
    assert.ok(
      teacherCatalog.some(
        (exercise) =>
          exercise.title === "Global scope exercise" &&
          exercise.scope === "global" &&
          !exercise.canManage,
      ),
    );
    assert.ok(
      teacherCatalog.some(
        (exercise) =>
          exercise.title === "Organization A exercise" && exercise.canManage,
      ),
    );
    assert.ok(
      !teacherCatalog.some(
        (exercise) => exercise.title === "Organization B exercise",
      ),
    );

    const adminCatalog = await adminData.listAdminExercises({
      ...teacherA,
      role: "admin",
      organizationId: null,
      organizationName: null,
    });
    assert.equal(
      adminCatalog.filter((exercise) => exercise.isBuiltIn).length,
      getExercises("es").length,
    );
    assert.ok(
      ["Global scope exercise", "Organization A exercise", "Organization B exercise"].every(
        (title) =>
          adminCatalog.some(
            (exercise) => exercise.title === title && exercise.canManage,
          ),
      ),
    );
    const organizationMetrics = await adminData.listOrganizations();
    const expectedExerciseCount = getExercises("es").length + 2;
    assert.equal(
      organizationMetrics.find((item) => item.id === organizationIds[0])
        ?.exerciseCount,
      expectedExerciseCount,
    );
    assert.equal(
      organizationMetrics.find((item) => item.id === organizationIds[1])
        ?.exerciseCount,
      expectedExerciseCount,
    );

    const [adminCookie, teacherCookie, cookie] = await Promise.all([
      createSessionCookie(staffIds[0]!),
      createSessionCookie(staffIds[1]!),
      createSessionCookie(studentId),
    ]);
    const adminPage = await fetch(`${baseUrl}/admin/exercises`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(adminPage.status, 200);
    const adminHtml = await adminPage.text();
    assert.match(adminHtml, /Catálogo global de la plataforma/);
    assert.doesNotMatch(adminHtml, /name="organizationId"/);

    const teacherPage = await fetch(`${baseUrl}/admin/exercises`, {
      headers: { Cookie: teacherCookie },
    });
    assert.equal(teacherPage.status, 200);
    const teacherHtml = await teacherPage.text();
    assert.match(teacherHtml, /privado para los alumnos y profesores/);
    assert.match(teacherHtml, /name="organizationId"/);

    const program = { main: { nodes: [], edges: [] }, functions: [] };

    for (const exerciseId of [exerciseIds[0], exerciseIds[1]]) {
      const response = await fetch(`${baseUrl}/api/submissions`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: `db-${exerciseId}`,
          exerciseTitle: "Scope integration",
          program,
          title: "Scope integration submission",
        }),
      });
      assert.equal(response.status, 200);
    }

    const foreignResponse = await fetch(`${baseUrl}/api/submissions`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseId: `db-${exerciseIds[2]}`,
        exerciseTitle: "Foreign organization exercise",
        program,
        title: "Forbidden scope submission",
      }),
    });
    assert.equal(foreignResponse.status, 403);

    const [foreignSubmissions] = await pool.query<
      (RowDataPacket & { count: number })[]
    >(
      "SELECT COUNT(*) AS count FROM submissions WHERE title = 'Forbidden scope submission' AND student_id = :studentId",
      { studentId },
    );
    assert.equal(Number(foreignSubmissions[0]?.count), 0);

    console.log("Exercise scope integration checks passed.");
  } finally {
    if (sessionHashes.length) {
      await pool.query("DELETE FROM user_sessions WHERE token_hash IN (?)", [
        sessionHashes,
      ]);
    }
    if (userIds.length) {
      await pool.query("DELETE FROM submissions WHERE student_id IN (?)", [userIds]);
      await pool.query("DELETE FROM users WHERE id IN (?)", [userIds]);
    }
    if (exerciseIds.length) {
      await pool.query("DELETE FROM exercises WHERE id IN (?)", [exerciseIds]);
    }
    if (organizationIds.length) {
      await pool.query("DELETE FROM organizations WHERE id IN (?)", [organizationIds]);
    }
    await pool.end();
  }
}

void main();
