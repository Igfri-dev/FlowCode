import { getPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

let schemaReadyPromise: Promise<void> | null = null;

type CountRow = RowDataPacket & {
  count: number;
};

export function ensureRuntimeSchema() {
  schemaReadyPromise ??= migrateRuntimeSchema();

  return schemaReadyPromise;
}

async function migrateRuntimeSchema() {
  await addColumnIfMissing(
    "exercises",
    "source_key",
    "VARCHAR(160) NULL AFTER slug",
  );
  await addIndexIfMissing(
    "exercises",
    "exercises_source_key_unique",
    "UNIQUE KEY exercises_source_key_unique (source_key)",
  );
  await addColumnIfMissing(
    "exercises",
    "test_cases",
    "JSON NULL AFTER starter_code",
  );
  await addColumnIfMissing(
    "exercises",
    "submission_deadline",
    "DATETIME NULL AFTER test_cases",
  );
  await addColumnIfMissing(
    "submissions",
    "exercise_key",
    "VARCHAR(160) NULL AFTER exercise_id",
  );
  await addColumnIfMissing(
    "submissions",
    "exercise_title",
    "VARCHAR(180) NULL AFTER exercise_key",
  );
  await addColumnIfMissing(
    "submissions",
    "test_result_json",
    "JSON NULL AFTER feedback",
  );
  await addColumnIfMissing(
    "submissions",
    "updated_at",
    "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER submitted_at",
  );

  await getPool().execute(
    `ALTER TABLE submissions
     MODIFY status ENUM('submitted', 'approved', 'incomplete', 'rejected')
     NOT NULL DEFAULT 'submitted'`,
  );
}

async function addIndexIfMissing(
  tableName: string,
  indexName: string,
  definition: string,
) {
  const [rows] = await getPool().query<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :tableName
       AND INDEX_NAME = :indexName`,
    { indexName, tableName },
  );

  if ((rows[0]?.count ?? 0) > 0) {
    return;
  }

  await getPool().execute(`ALTER TABLE ${tableName} ADD ${definition}`);
}

async function addColumnIfMissing(
  tableName: string,
  columnName: string,
  definition: string,
) {
  const [rows] = await getPool().query<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :tableName
       AND COLUMN_NAME = :columnName`,
    {
      tableName,
      columnName,
    },
  );

  if ((rows[0]?.count ?? 0) > 0) {
    return;
  }

  await getPool().execute(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
  );
}
