CREATE DATABASE IF NOT EXISTS flowcode
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id INT UNSIGNED NULL,
  username VARCHAR(80) NOT NULL,
  email VARCHAR(254) NULL,
  email_verified_at DATETIME NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  role ENUM('student', 'teacher', 'admin', 'independent') NOT NULL DEFAULT 'student',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_unique (username),
  UNIQUE KEY users_email_unique (email),
  KEY users_role_index (role),
  KEY users_organization_id_index (organization_id),
  CONSTRAINT users_organization_id_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
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
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
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
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (owner_id) REFERENCES users(id)
    ON DELETE CASCADE
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
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE CASCADE,
  CONSTRAINT user_groups_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_group_members (
  group_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  KEY user_group_members_user_id_index (user_id),
  CONSTRAINT user_group_members_group_id_fk
    FOREIGN KEY (group_id) REFERENCES user_groups(id)
    ON DELETE CASCADE,
  CONSTRAINT user_group_members_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY user_sessions_token_hash_unique (token_hash),
  KEY user_sessions_user_id_index (user_id),
  KEY user_sessions_expires_at_index (expires_at),
  CONSTRAINT user_sessions_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NULL organization_id: catálogo global de plataforma.
-- organization_id con valor: ejercicio privado de esa organización.
CREATE TABLE IF NOT EXISTS exercises (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id INT UNSIGNED NULL,
  slug VARCHAR(160) NOT NULL,
  source_key VARCHAR(160) NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  objective TEXT NOT NULL,
  difficulty ENUM('facil', 'media', 'dificil') NOT NULL DEFAULT 'facil',
  starter_code MEDIUMTEXT NULL,
  test_cases JSON NULL,
  submission_deadline DATETIME NULL,
  tags VARCHAR(500) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY exercises_slug_unique (slug),
  UNIQUE KEY exercises_organization_source_key_unique (organization_id, source_key),
  KEY exercises_organization_id_index (organization_id),
  KEY exercises_created_by_index (created_by),
  KEY exercises_is_active_index (is_active),
  CONSTRAINT exercises_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT exercises_organization_id_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  organization_id INT UNSIGNED NULL,
  exercise_id INT UNSIGNED NULL,
  exercise_key VARCHAR(160) NULL,
  exercise_title VARCHAR(180) NULL,
  title VARCHAR(180) NOT NULL,
  code MEDIUMTEXT NULL,
  diagram_json JSON NOT NULL,
  status ENUM('submitted', 'approved', 'incomplete', 'rejected') NOT NULL DEFAULT 'submitted',
  feedback TEXT NULL,
  test_result_json JSON NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  reviewed_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY submissions_student_id_index (student_id),
  KEY submissions_organization_id_index (organization_id),
  KEY submissions_exercise_id_index (exercise_id),
  KEY submissions_reviewed_by_index (reviewed_by),
  KEY submissions_submitted_at_index (submitted_at),
  CONSTRAINT submissions_student_id_fk
    FOREIGN KEY (student_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT submissions_exercise_id_fk
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    ON DELETE SET NULL,
  CONSTRAINT submissions_reviewed_by_fk
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT submissions_organization_id_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
