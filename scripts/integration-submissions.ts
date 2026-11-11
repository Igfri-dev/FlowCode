import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { importJavaScriptToFlow } from "../src/features/flow/parser";
import type { FlowProgram } from "../src/types/flow";

loadEnvConfig(process.cwd());
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";

async function main() {
  const [{ getPool }, { ensureRuntimeSchema }] = await Promise.all([
    import("../src/lib/db"), import("../src/lib/schema"),
  ]);
  await ensureRuntimeSchema();
  const pool = getPool();
  const prefix = `submissions${Date.now()}`;
  const organizationIds: number[] = [];
  const userIds: number[] = [];
  let exerciseId: number | undefined;

  async function account(role: "student" | "independent", organizationId: number | null, suffix: string) {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (organization_id, username, email, email_verified_at,
       password_hash, full_name, role, must_change_password)
       VALUES (:organizationId, :username, :email, NOW(), 'unused-no-password-login', :suffix, :role, 0)`,
      { organizationId, username: `${prefix}-${suffix}`, email: `${prefix}-${suffix}@example.com`, suffix, role },
    );
    userIds.push(result.insertId);
    const token = randomBytes(32).toString("hex");
    await pool.execute(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES (:id, :hash, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      { id: result.insertId, hash: createHash("sha256").update(token).digest("hex") },
    );
    return { id: result.insertId, cookie: `flowcode_session=${token}` };
  }

  async function request(path: string, cookie: string | null, body: object, method = "POST") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...cookie ? { Cookie: cookie } : {} },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  }

  function program(code: string): FlowProgram {
    const imported = importJavaScriptToFlow(code);
    assert.ok(imported.ok, imported.ok ? "" : imported.message);
    return {
      main: { nodes: imported.nodes as FlowProgram["main"]["nodes"], edges: imported.edges },
      functions: imported.functions as FlowProgram["functions"],
    };
  }

  try {
    for (const suffix of ["a", "b"]) {
      const [result] = await pool.execute<ResultSetHeader>(
        "INSERT INTO organizations (name, slug) VALUES (:name, :name)",
        { name: `${prefix}-${suffix}` },
      );
      organizationIds.push(result.insertId);
    }
    const student = await account("student", organizationIds[0]!, "student");
    const classmate = await account("student", organizationIds[0]!, "classmate");
    const foreignStudent = await account("student", organizationIds[1]!, "foreign");
    const owner = await account("independent", null, "owner");
    const otherOwner = await account("independent", null, "other-owner");
    const validProgram = program("console.log(1);");
    const submissionBody = { title: `${prefix}-submission`, program: validProgram };

    assert.equal((await request("/api/submissions", null, submissionBody)).status, 401);
    assert.equal((await request("/api/submissions", owner.cookie, submissionBody)).status, 401);
    assert.equal((await request("/api/projects", student.cookie, submissionBody)).status, 401);
    assert.equal((await request("/api/projects", null, submissionBody)).status, 401);

    const createdProject = await request("/api/projects", owner.cookie, submissionBody);
    assert.equal(createdProject.status, 200);
    const { id: projectId } = await createdProject.json() as { id: number };
    assert.equal((await request(`/api/projects/${projectId}`, otherOwner.cookie,
      { ...submissionBody, title: "Unauthorized overwrite" }, "PUT")).status, 404);
    const [projects] = await pool.query<(RowDataPacket & { title: string })[]>(
      "SELECT title FROM projects WHERE id = :projectId", { projectId },
    );
    assert.equal(projects[0]?.title, submissionBody.title);

    const [exercise] = await pool.execute<ResultSetHeader>(
      `INSERT INTO exercises (organization_id, slug, title, description, objective,
       difficulty, test_cases, submission_deadline, is_active)
       VALUES (:organizationId, :slug, 'Integration exercise', 'Description', 'Objective',
       'facil', :testCases, DATE_ADD(NOW(), INTERVAL 1 HOUR), 1)`,
      { organizationId: organizationIds[0], slug: prefix, testCases: JSON.stringify([{ expectedOutputs: ["1"] }]) },
    );
    exerciseId = exercise.insertId;
    const body = { ...submissionBody, exerciseId: `db-${exerciseId}` };
    assert.equal((await request("/api/submissions", foreignStudent.cookie, body)).status, 403);
    assert.equal((await request("/api/submissions", student.cookie, body)).status, 200);

    const [rows] = await pool.query<(RowDataPacket & { id: number; test_result_json: string | { passed: boolean } })[]>(
      "SELECT id, test_result_json FROM submissions WHERE student_id = :studentId ORDER BY id DESC LIMIT 1",
      { studentId: student.id },
    );
    const submission = rows[0]!;
    const originalResult = typeof submission.test_result_json === "string"
      ? JSON.parse(submission.test_result_json) : submission.test_result_json;
    assert.equal(originalResult.passed, true);
    for (const cookie of [classmate.cookie, foreignStudent.cookie]) {
      assert.equal((await request(`/api/submissions/${submission.id}`, cookie, body, "PUT")).status, 404);
    }

    // Matching output cannot make an unending program pass automatic evaluation.
    const looping = { ...body, program: program("console.log(1); while (true) { let x = 1; }") };
    assert.equal((await request(`/api/submissions/${submission.id}`, student.cookie, looping, "PUT")).status, 200);
    const [updated] = await pool.query<(RowDataPacket & { test_result_json: string | { passed: boolean } })[]>(
      "SELECT test_result_json FROM submissions WHERE id = :id", { id: submission.id },
    );
    const failedResult = typeof updated[0]!.test_result_json === "string"
      ? JSON.parse(updated[0]!.test_result_json) : updated[0]!.test_result_json;
    assert.equal(failedResult.passed, false);

    await pool.execute("UPDATE exercises SET submission_deadline = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = :exerciseId", { exerciseId });
    assert.equal((await request(`/api/submissions/${submission.id}`, student.cookie, body, "PUT")).status, 403);
    assert.equal((await request("/api/submissions", student.cookie, body)).status, 403);
    console.log("Project ownership, submission permissions, deadlines and evaluation integration checks passed.");
  } finally {
    if (userIds.length) {
      await pool.query("DELETE FROM submissions WHERE student_id IN (?)", [userIds]);
      await pool.query("DELETE FROM users WHERE id IN (?)", [userIds]);
    }
    if (exerciseId) await pool.execute("DELETE FROM exercises WHERE id = :exerciseId", { exerciseId });
    if (organizationIds.length) await pool.query("DELETE FROM organizations WHERE id IN (?)", [organizationIds]);
    await pool.end();
  }
}

void main();
