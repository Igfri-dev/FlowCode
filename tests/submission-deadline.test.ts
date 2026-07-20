import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSubmissionDeadlineInput } from "../src/lib/submission-deadline";

test("normalizes an HTML datetime-local deadline for MySQL", () => {
  assert.equal(
    normalizeSubmissionDeadlineInput("2026-07-20T18:45"),
    "2026-07-20 18:45:00",
  );
});

test("allows an exercise to have no deadline", () => {
  assert.equal(normalizeSubmissionDeadlineInput(""), null);
  assert.equal(normalizeSubmissionDeadlineInput("   "), null);
});

test("rejects malformed or impossible deadlines", () => {
  assert.throws(() => normalizeSubmissionDeadlineInput("2026-02-30T12:00"));
  assert.throws(() => normalizeSubmissionDeadlineInput("2026-07-20"));
  assert.throws(() => normalizeSubmissionDeadlineInput("2026-07-20T25:00"));
});
