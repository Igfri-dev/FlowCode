USE flowcode;

CREATE TABLE IF NOT EXISTS organizations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_id INT UNSIGNED NULL AFTER id;

SET @flowcode_email_verification_column_was_missing = (
  SELECT COUNT(*) = 0
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email_verified_at'
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(254) NULL AFTER username,
  ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL AFTER email,
  ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER role;

UPDATE users
SET email_verified_at = NOW()
WHERE email IS NOT NULL
  AND email_verified_at IS NULL
  AND @flowcode_email_verification_column_was_missing = 1;

ALTER TABLE users
  MODIFY role ENUM('student', 'teacher', 'admin', 'independent')
  NOT NULL DEFAULT 'student';

ALTER TABLE users
  ADD UNIQUE KEY users_email_unique (email);

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS organization_id INT UNSIGNED NULL AFTER id;

-- Desde esta migración, los ejercicios sin organización forman el catálogo
-- global y no deben copiarse a cada organización.

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS source_key VARCHAR(160) NULL AFTER slug;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS test_cases JSON NULL AFTER starter_code;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS submission_deadline DATETIME NULL AFTER test_cases;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS organization_id INT UNSIGNED NULL AFTER student_id,
  ADD COLUMN IF NOT EXISTS exercise_key VARCHAR(160) NULL AFTER exercise_id,
  ADD COLUMN IF NOT EXISTS exercise_title VARCHAR(180) NULL AFTER exercise_key;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS test_result_json JSON NULL AFTER feedback;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ON UPDATE CURRENT_TIMESTAMP AFTER submitted_at;

ALTER TABLE exercises
  DROP INDEX exercises_source_key_unique;

ALTER TABLE users
  ADD KEY users_organization_id_index (organization_id),
  ADD CONSTRAINT users_organization_id_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT;

ALTER TABLE exercises
  ADD UNIQUE KEY exercises_organization_source_key_unique (organization_id, source_key),
  ADD KEY exercises_organization_id_index (organization_id),
  ADD CONSTRAINT exercises_organization_id_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT;

ALTER TABLE submissions
  ADD KEY submissions_organization_id_index (organization_id),
  ADD CONSTRAINT submissions_organization_id_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT;

INSERT INTO organizations (name, slug)
SELECT 'Legacy organization', 'legacy-organization'
WHERE EXISTS (
  SELECT 1 FROM users
  WHERE role IN ('student', 'teacher') AND organization_id IS NULL
)
ON DUPLICATE KEY UPDATE name = VALUES(name);

UPDATE users
SET organization_id = (
  SELECT id FROM organizations WHERE slug = 'legacy-organization' LIMIT 1
)
WHERE role IN ('student', 'teacher') AND organization_id IS NULL;

UPDATE submissions s
INNER JOIN users student ON student.id = s.student_id
SET s.organization_id = student.organization_id
WHERE s.organization_id IS NULL AND student.organization_id IS NOT NULL;

ALTER TABLE submissions
  MODIFY status ENUM('submitted', 'approved', 'incomplete', 'rejected')
  NOT NULL DEFAULT 'submitted';

CREATE TABLE IF NOT EXISTS password_reset_tokens (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_outbox (
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
  KEY email_outbox_claim_token_index (claim_token),
  CONSTRAINT email_outbox_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE email_outbox
  MODIFY message_type ENUM('welcome', 'password_reset', 'email_verification') NOT NULL,
  MODIFY status ENUM('pending', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS claim_token CHAR(36) NULL AFTER attempts,
  ADD COLUMN IF NOT EXISTS claimed_at DATETIME NULL AFTER claim_token;

CREATE TABLE IF NOT EXISTS projects (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id INT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  group_type ENUM('organization', 'course', 'administrators', 'custom') NOT NULL DEFAULT 'custom',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_group_members (
  group_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  KEY user_group_members_user_id_index (user_id),
  CONSTRAINT user_group_members_group_id_fk
    FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
  CONSTRAINT user_group_members_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
