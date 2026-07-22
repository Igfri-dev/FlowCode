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
  await getPool().execute(
    `CREATE TABLE IF NOT EXISTS organizations (
       id INT UNSIGNED NOT NULL AUTO_INCREMENT,
       name VARCHAR(160) NOT NULL,
       slug VARCHAR(160) NOT NULL,
       is_active TINYINT(1) NOT NULL DEFAULT 1,
       created_by INT UNSIGNED NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY organizations_slug_unique (slug),
       KEY organizations_is_active_index (is_active)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await addColumnIfMissing(
    "users",
    "organization_id",
    "INT UNSIGNED NULL AFTER id",
  );
  await addColumnIfMissing(
    "users",
    "email",
    "VARCHAR(254) NULL AFTER username",
  );
  const emailVerificationColumnAdded = await addColumnIfMissing(
    "users",
    "email_verified_at",
    "DATETIME NULL AFTER email",
  );
  if (emailVerificationColumnAdded) {
    await getPool().execute(
      `UPDATE users
       SET email_verified_at = NOW()
       WHERE email IS NOT NULL`,
    );
  }
  await addColumnIfMissing(
    "users",
    "must_change_password",
    "TINYINT(1) NOT NULL DEFAULT 0 AFTER role",
  );
  await getPool().execute(
    `ALTER TABLE users
     MODIFY role ENUM('student', 'teacher', 'admin', 'independent')
     NOT NULL DEFAULT 'student'`,
  );
  await addIndexIfMissing(
    "users",
    "users_email_unique",
    "UNIQUE KEY users_email_unique (email)",
  );
  await addIndexIfMissing(
    "users",
    "users_organization_id_index",
    "KEY users_organization_id_index (organization_id)",
  );
  await addForeignKeyIfMissing(
    "users",
    "users_organization_id_fk",
    "FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT",
  );
  await addColumnIfMissing(
    "exercises",
    "organization_id",
    "INT UNSIGNED NULL AFTER id",
  );
  await addColumnIfMissing(
    "exercises",
    "source_key",
    "VARCHAR(160) NULL AFTER slug",
  );
  await dropIndexIfPresent("exercises", "exercises_source_key_unique");
  await addIndexIfMissing(
    "exercises",
    "exercises_organization_source_key_unique",
    "UNIQUE KEY exercises_organization_source_key_unique (organization_id, source_key)",
  );
  await addIndexIfMissing(
    "exercises",
    "exercises_organization_id_index",
    "KEY exercises_organization_id_index (organization_id)",
  );
  await addForeignKeyIfMissing(
    "exercises",
    "exercises_organization_id_fk",
    "FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT",
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
    "organization_id",
    "INT UNSIGNED NULL AFTER student_id",
  );
  await addIndexIfMissing(
    "submissions",
    "submissions_organization_id_index",
    "KEY submissions_organization_id_index (organization_id)",
  );
  await addForeignKeyIfMissing(
    "submissions",
    "submissions_organization_id_fk",
    "FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT",
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

  await getPool().execute(
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       user_id INT UNSIGNED NOT NULL,
       token_hash CHAR(64) NOT NULL,
       expires_at DATETIME NOT NULL,
       used_at DATETIME NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY password_reset_tokens_hash_unique (token_hash),
       KEY password_reset_tokens_user_id_index (user_id),
       KEY password_reset_tokens_expires_at_index (expires_at),
       CONSTRAINT password_reset_tokens_user_id_fk
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await getPool().execute(
    `CREATE TABLE IF NOT EXISTS email_verification_tokens (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       user_id INT UNSIGNED NOT NULL,
       token_hash CHAR(64) NOT NULL,
       expires_at DATETIME NOT NULL,
       used_at DATETIME NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY email_verification_tokens_hash_unique (token_hash),
       KEY email_verification_tokens_user_id_index (user_id),
       KEY email_verification_tokens_expires_at_index (expires_at),
       CONSTRAINT email_verification_tokens_user_id_fk
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await getPool().execute(
    `CREATE TABLE IF NOT EXISTS email_outbox (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       user_id INT UNSIGNED NULL,
       recipient VARCHAR(254) NOT NULL,
       message_type ENUM('welcome', 'password_reset', 'email_verification') NOT NULL,
       payload_encrypted MEDIUMTEXT NOT NULL,
       status ENUM('pending', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'pending',
       attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
       claim_token CHAR(36) NULL,
       claimed_at DATETIME NULL,
       last_error VARCHAR(1000) NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       sent_at DATETIME NULL,
       PRIMARY KEY (id),
       KEY email_outbox_status_created_index (status, created_at),
       KEY email_outbox_user_id_index (user_id),
       CONSTRAINT email_outbox_user_id_fk
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await getPool().execute(
    `ALTER TABLE email_outbox
     MODIFY message_type ENUM('welcome', 'password_reset', 'email_verification') NOT NULL,
     MODIFY status ENUM('pending', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'pending'`,
  );
  await addColumnIfMissing(
    "email_outbox",
    "claim_token",
    "CHAR(36) NULL AFTER attempts",
  );
  await addColumnIfMissing(
    "email_outbox",
    "claimed_at",
    "DATETIME NULL AFTER claim_token",
  );
  await addIndexIfMissing(
    "email_outbox",
    "email_outbox_claim_token_index",
    "KEY email_outbox_claim_token_index (claim_token)",
  );
  await getPool().execute(
    `CREATE TABLE IF NOT EXISTS projects (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       owner_id INT UNSIGNED NOT NULL,
       title VARCHAR(180) NOT NULL,
       diagram_json JSON NOT NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       KEY projects_owner_updated_index (owner_id, updated_at),
       CONSTRAINT projects_owner_id_fk
         FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await getPool().execute(
    `CREATE TABLE IF NOT EXISTS user_groups (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       organization_id INT UNSIGNED NULL,
       name VARCHAR(160) NOT NULL,
       group_type ENUM('organization', 'course', 'administrators', 'custom')
         NOT NULL DEFAULT 'custom',
       created_by INT UNSIGNED NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       KEY user_groups_organization_id_index (organization_id),
       KEY user_groups_created_by_index (created_by),
       CONSTRAINT user_groups_organization_id_fk
         FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
       CONSTRAINT user_groups_created_by_fk
         FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await getPool().execute(
    `CREATE TABLE IF NOT EXISTS user_group_members (
       group_id BIGINT UNSIGNED NOT NULL,
       user_id INT UNSIGNED NOT NULL,
       added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (group_id, user_id),
       KEY user_group_members_user_id_index (user_id),
       CONSTRAINT user_group_members_group_id_fk
         FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
       CONSTRAINT user_group_members_user_id_fk
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await migrateLegacyOrganizationData();
}

async function migrateLegacyOrganizationData() {
  const [rows] = await getPool().query<CountRow[]>(
     `SELECT COUNT(*) AS count
     FROM users
     WHERE role IN ('student', 'teacher') AND organization_id IS NULL`,
  );

  if ((rows[0]?.count ?? 0) === 0) {
    await getPool().execute(
      `UPDATE submissions s
       INNER JOIN users student ON student.id = s.student_id
       SET s.organization_id = student.organization_id
       WHERE s.organization_id IS NULL AND student.organization_id IS NOT NULL`,
    );
    return;
  }

  await getPool().execute(
    `INSERT INTO organizations (name, slug)
     VALUES ('Legacy organization', 'legacy-organization')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
  );
  const [organizations] = await getPool().query<
    (RowDataPacket & { id: number })[]
  >(
    `SELECT id FROM organizations WHERE slug = 'legacy-organization' LIMIT 1`,
  );
  const organizationId = organizations[0]?.id;

  if (!organizationId) {
    return;
  }

  await getPool().execute(
    `UPDATE users
     SET organization_id = :organizationId
     WHERE role IN ('student', 'teacher') AND organization_id IS NULL`,
    { organizationId },
  );
  await getPool().execute(
    `UPDATE submissions s
     INNER JOIN users student ON student.id = s.student_id
     SET s.organization_id = student.organization_id
     WHERE s.organization_id IS NULL AND student.organization_id IS NOT NULL`,
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

async function dropIndexIfPresent(tableName: string, indexName: string) {
  const [rows] = await getPool().query<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :tableName
       AND INDEX_NAME = :indexName`,
    { indexName, tableName },
  );

  if ((rows[0]?.count ?? 0) === 0) {
    return;
  }

  await getPool().execute(`ALTER TABLE ${tableName} DROP INDEX ${indexName}`);
}

async function addForeignKeyIfMissing(
  tableName: string,
  constraintName: string,
  definition: string,
) {
  const [rows] = await getPool().query<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = :tableName
       AND CONSTRAINT_NAME = :constraintName
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    { constraintName, tableName },
  );

  if ((rows[0]?.count ?? 0) > 0) {
    return;
  }

  await getPool().execute(
    `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${definition}`,
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
    return false;
  }

  await getPool().execute(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
  );

  return true;
}
