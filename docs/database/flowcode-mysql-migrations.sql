USE flowcode;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS source_key VARCHAR(160) NULL AFTER slug;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS test_cases JSON NULL AFTER starter_code;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS submission_deadline DATETIME NULL AFTER test_cases;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS exercise_key VARCHAR(160) NULL AFTER exercise_id,
  ADD COLUMN IF NOT EXISTS exercise_title VARCHAR(180) NULL AFTER exercise_key;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS test_result_json JSON NULL AFTER feedback;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ON UPDATE CURRENT_TIMESTAMP AFTER submitted_at;

ALTER TABLE submissions
  MODIFY status ENUM('submitted', 'approved', 'incomplete', 'rejected')
  NOT NULL DEFAULT 'submitted';
