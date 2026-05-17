CREATE DATABASE IF NOT EXISTS flowcode
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE flowcode;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_unique (username),
  KEY users_role_index (role)
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

CREATE TABLE IF NOT EXISTS exercises (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  objective TEXT NOT NULL,
  difficulty ENUM('facil', 'media', 'dificil') NOT NULL DEFAULT 'facil',
  starter_code MEDIUMTEXT NULL,
  test_cases JSON NULL,
  tags VARCHAR(500) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY exercises_slug_unique (slug),
  KEY exercises_created_by_index (created_by),
  KEY exercises_is_active_index (is_active),
  CONSTRAINT exercises_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  exercise_id INT UNSIGNED NULL,
  title VARCHAR(180) NOT NULL,
  code MEDIUMTEXT NULL,
  diagram_json JSON NOT NULL,
  status ENUM('submitted', 'approved', 'incomplete', 'rejected') NOT NULL DEFAULT 'submitted',
  feedback TEXT NULL,
  test_result_json JSON NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  reviewed_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY submissions_student_id_index (student_id),
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
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
