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
    "test_cases",
    "JSON NULL AFTER starter_code",
  );
  await addColumnIfMissing(
    "submissions",
    "test_result_json",
    "JSON NULL AFTER feedback",
  );

  await getPool().execute(
    `ALTER TABLE submissions
     MODIFY status ENUM('submitted', 'approved', 'incomplete', 'rejected')
     NOT NULL DEFAULT 'submitted'`,
  );
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
