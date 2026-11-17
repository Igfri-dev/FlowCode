import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import mysql from "mysql2/promise";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function main() {
  const [{ getPool }, { ensureRuntimeSchema }, { ensureBootstrapAdmin }] =
    await Promise.all([
      import("../src/lib/db"),
      import("../src/lib/schema"),
      import("../src/lib/bootstrap-admin"),
    ]);
  let connection: mysql.Connection | undefined;

  try {
    const database = process.env.MYSQL_DATABASE ?? "flowcode";
    const schema = (
      await readFile(resolve("docs/database/flowcode-mysql.sql"), "utf8")
    ).replace(
      /^CREATE DATABASE IF NOT EXISTS flowcode\s+CHARACTER SET utf8mb4\s+COLLATE utf8mb4_unicode_ci;\s*USE flowcode;\s*/u,
      "",
    );
    if (
      /^\s*(?:(?:CREATE|DROP)\s+(?:DATABASE|SCHEMA)\b|USE\b)/imu.test(schema)
    ) {
      throw new Error("The schema contains an unexpected database selection.");
    }

    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST ?? "127.0.0.1",
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? "root",
      password: process.env.MYSQL_PASSWORD ?? "",
      multipleStatements: true,
    });
    try {
      // Existing hosting databases do not require CREATE DATABASE permission.
      // USE keeps authentication intact, including after an unknown-database error.
      await connection.query("USE ??", [database]);
    } catch (error) {
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ER_BAD_DB_ERROR"
        )
      ) {
        throw error;
      }
      await connection.query(
        "CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
        [database],
      );
      await connection.query("USE ??", [database]);
    }

    await connection.query(schema);
    await ensureRuntimeSchema();
    const adminUsername = await ensureBootstrapAdmin({ required: true });
    console.info(`[db:setup] Database ready: ${database}`);
    console.info(
      adminUsername
        ? `[db:setup] Administrator created: ${adminUsername}. Sign in with the temporary password from .env.local; you must change it before continuing.`
        : "[db:setup] Existing users preserved; administrator credentials were not changed.",
    );
  } finally {
    try {
      await connection?.end();
    } finally {
      await getPool().end();
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    "[db:setup] Setup failed:",
    error instanceof Error ? error.message : "Unknown error.",
  );
  process.exitCode = 1;
});
