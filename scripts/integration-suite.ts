import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { loadEnvConfig } from "@next/env";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { verifyPassword } from "../src/lib/password";

loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);

async function availablePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("No test port available.");
  await new Promise<void>((resolveClose, reject) => {
    listener.close((error) => error ? reject(error) : resolveClose());
  });
  return address.port;
}

async function stopServer(server: ChildProcess) {
  if (!server.pid || server.exitCode !== null) return;
  if (process.platform === "win32") {
    const taskkill = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
      stdio: "ignore", windowsHide: true,
    });
    await once(taskkill, "exit");
  } else {
    process.kill(-server.pid, "SIGTERM");
    await Promise.race([once(server, "exit"), delay(5000)]);
    if (server.exitCode === null) process.kill(-server.pid, "SIGKILL");
  }
}

async function runSetup(env: NodeJS.ProcessEnv, expectedExit = 0) {
  const child = spawn(process.execPath, ["--import", "tsx", resolve("scripts/setup-database.ts")], {
    env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  const [code] = await once(child, "exit");
  assert.equal(code, expectedExit, output);
  return output;
}

async function main() {
  // Never use MYSQL_DATABASE: each run owns only this newly generated database.
  const database = `flowcode_test_${Date.now()}_${randomBytes(4).toString("hex")}`;
  if (!/^flowcode_test_[0-9]+_[a-f0-9]{8}$/.test(database)) {
    throw new Error("Invalid generated integration database name.");
  }
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
  });
  let created = false;
  let server: ChildProcess | undefined;
  let output = "";
  try {
    const port = await availablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const production = process.env.FLOWCODE_INTEGRATION_SERVER === "production";
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      MYSQL_DATABASE: database,
      APP_URL: baseUrl,
      NODE_ENV: production ? "production" : "development",
      EMAIL_QUEUE_SECRET: randomBytes(32).toString("hex"),
      SMTP_HOST: "", SMTP_USER: "", SMTP_PASSWORD: "",
      FLOWCODE_BOOTSTRAP_ADMIN_USERNAME: "integration_admin",
      FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD: `${randomBytes(24).toString("hex")}1`,
      NEXT_TELEMETRY_DISABLED: "1",
    };

    // Exercise the actual installer against a missing, isolated database.
    const [existingDatabases] = await connection.query<RowDataPacket[]>(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", [database],
    );
    assert.equal(existingDatabases.length, 0, "The integration database must not already exist");
    created = true;
    assert.match(await runSetup({ ...env, FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD: "" }, 1), /Set FLOWCODE_BOOTSTRAP/);
    await connection.query("USE ??", [database]);
    assert.match(await runSetup({ ...env, FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD: "short1" }, 1), /at least 8 characters/);
    const [emptyUsers] = await connection.query<RowDataPacket[]>("SELECT id FROM users");
    assert.equal(emptyUsers.length, 0, "Invalid setup must not create an administrator");

    await runSetup(env);
    const [admins] = await connection.query<RowDataPacket[]>("SELECT * FROM users");
    assert.equal(admins.length, 1);
    assert.equal(admins[0].username, env.FLOWCODE_BOOTSTRAP_ADMIN_USERNAME);
    assert.equal(admins[0].role, "admin");
    assert.equal(admins[0].must_change_password, 1);
    assert.ok(await verifyPassword(env.FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD ?? "", admins[0].password_hash));

    await runSetup({ ...env, FLOWCODE_BOOTSTRAP_ADMIN_USERNAME: "another_admin", FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD: "different123" });
    const [unchangedAdmins] = await connection.query<RowDataPacket[]>("SELECT * FROM users");
    assert.equal(unchangedAdmins.length, 1);
    assert.equal(unchangedAdmins[0].password_hash, admins[0].password_hash);
    assert.equal(unchangedAdmins[0].must_change_password, 1);
    console.log("Database installation and repeat setup checks passed.");

    server = spawn(process.execPath, [
      require.resolve("next/dist/bin/next"),
      production ? "start" : "dev",
      ...production ? [] : ["--webpack"],
      "--hostname", "127.0.0.1", "--port", String(port),
    ], { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, detached: process.platform !== "win32" });
    const capture = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-12000); };
    server.stdout?.on("data", capture);
    server.stderr?.on("data", capture);
    let ready = false;
    for (let attempt = 0; attempt < 120 && !ready; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Integration server exited.\n${output}`);
      try {
        const response = await fetch(`${baseUrl}/api/projects`, {
          method: "POST", signal: AbortSignal.timeout(5000),
        });
        ready = response.status === 401;
      } catch { /* The server may still be starting or compiling. */ }
      if (!ready) await delay(500);
    }
    if (!ready) throw new Error(`Integration server did not become ready.\n${output}`);
    console.log(`Running isolated MySQL/HTTP checks (${production ? "production" : "development"}).`);
    for (const script of [
      "integration-first-login.ts",
      "integration-auth-projects.ts", "integration-exercise-scope.ts",
      "integration-user-groups.ts", "integration-submissions.ts",
    ]) {
      const child = spawn(process.execPath, ["--import", "tsx", resolve("scripts", script)], {
        env, stdio: "inherit", windowsHide: true,
      });
      const [code] = await once(child, "exit");
      if (code !== 0) throw new Error(`${script} failed (exit ${String(code)}).\n${output}`);
    }
    const [beforeRerun] = await connection.query<RowDataPacket[]>("SELECT password_hash, must_change_password FROM users WHERE username = ?", [env.FLOWCODE_BOOTSTRAP_ADMIN_USERNAME]);
    await runSetup(env);
    const [afterRerun] = await connection.query<RowDataPacket[]>("SELECT password_hash, must_change_password FROM users WHERE username = ?", [env.FLOWCODE_BOOTSTRAP_ADMIN_USERNAME]);
    assert.equal(afterRerun[0].password_hash, beforeRerun[0].password_hash);
    assert.equal(afterRerun[0].must_change_password, 0);
    console.log("All isolated integration checks passed.");
  } finally {
    try {
      if (server) await stopServer(server);
    } finally {
      try {
        if (created) await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
      } finally {
        await connection.end();
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Integration suite failed.");
  process.exitCode = 1;
});
