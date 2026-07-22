import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import type { RowDataPacket } from "mysql2/promise";

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
  const prefix = `flowcodehttp${Date.now()}`;
  const createdUserIds: number[] = [];
  const createdSessionHashes: string[] = [];
  let organizationId: number | null = null;

  async function createSession(userId: number) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await pool.execute(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES (:userId, :tokenHash, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      { userId, tokenHash },
    );
    createdSessionHashes.push(tokenHash);
    return `flowcode_session=${token}`;
  }

  try {
    const passwordHash = await hashPassword("secure123");
    const [independentResult] = await pool.execute(
      `INSERT INTO users
         (username, email, email_verified_at, password_hash, full_name, role, must_change_password)
       VALUES (:username, :email, NOW(), :passwordHash, 'Independent Test', 'independent', 0)`,
      {
        username: `${prefix}independent`,
        email: `${prefix}independent@example.com`,
        passwordHash,
      },
    );
    const independentId = Number(
      (independentResult as { insertId: number }).insertId,
    );
    createdUserIds.push(independentId);
    const independentCookie = await createSession(independentId);
    const program = { main: { nodes: [], edges: [] }, functions: [] };
    const createResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        Cookie: independentCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Integration project", program }),
    });
    assert.equal(createResponse.status, 200);
    const createdProject = (await createResponse.json()) as { id: number };
    assert.ok(createdProject.id > 0);

    const updateResponse = await fetch(
      `${baseUrl}/api/projects/${createdProject.id}`,
      {
        method: "PUT",
        headers: {
          Cookie: independentCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Updated integration project", program }),
      },
    );
    assert.equal(updateResponse.status, 200);
    const projectsResponse = await fetch(`${baseUrl}/projects`, {
      headers: { Cookie: independentCookie },
    });
    assert.equal(projectsResponse.status, 200);
    assert.match(await projectsResponse.text(), /Updated integration project/);

    const [organizationResult] = await pool.execute(
      "INSERT INTO organizations (name, slug) VALUES (:name, :slug)",
      { name: prefix, slug: prefix },
    );
    organizationId = Number(
      (organizationResult as { insertId: number }).insertId,
    );
    const [studentResult] = await pool.execute(
      `INSERT INTO users
         (organization_id, username, email, password_hash, full_name, role, must_change_password)
       VALUES (:organizationId, :username, :email, :passwordHash, 'Student Test', 'student', 1)`,
      {
        organizationId,
        username: `${prefix}student`,
        email: `${prefix}student@example.com`,
        passwordHash,
      },
    );
    const studentId = Number((studentResult as { insertId: number }).insertId);
    createdUserIds.push(studentId);
    const studentCookie = await createSession(studentId);
    const forcedChangeResponse = await fetch(`${baseUrl}/`, {
      headers: { Cookie: studentCookie },
      redirect: "manual",
    });
    assert.equal(forcedChangeResponse.headers.get("location"), "/change-password");

    const [admins] = await pool.query<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1",
    );
    assert.ok(admins[0]?.id);
    const adminCookie = await createSession(admins[0].id);
    const adminResponse = await fetch(`${baseUrl}/admin/users`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(adminResponse.status, 200);
    const adminHtml = await adminResponse.text();
    assert.match(adminHtml, /Carga masiva por CSV/);
    assert.match(adminHtml, /plantilla-usuarios-flowcode\.csv/);

    console.log("Authentication and project HTTP integration checks passed.");
  } finally {
    if (createdSessionHashes.length) {
      await pool.query("DELETE FROM user_sessions WHERE token_hash IN (?)", [
        createdSessionHashes,
      ]);
    }
    if (createdUserIds.length) {
      await pool.query("DELETE FROM users WHERE id IN (?)", [createdUserIds]);
    }
    if (organizationId) {
      await pool.execute("DELETE FROM organizations WHERE id = :id", {
        id: organizationId,
      });
    }
    await pool.end();
  }
}

void main();
