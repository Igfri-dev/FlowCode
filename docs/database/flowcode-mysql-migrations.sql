USE flowcode;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS test_cases JSON NULL AFTER starter_code;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS test_result_json JSON NULL AFTER feedback;

ALTER TABLE submissions
  MODIFY status ENUM('submitted', 'approved', 'incomplete', 'rejected')
  NOT NULL DEFAULT 'submitted';
