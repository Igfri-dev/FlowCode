import assert from "node:assert/strict";
import test from "node:test";
import {
  generateTemporaryPassword,
  getPasswordPolicyError,
  isValidEmail,
} from "../src/lib/password-policy";

test("requires eight password characters and a number", () => {
  assert.match(getPasswordPolicyError("short1") ?? "", /8/);
  assert.match(getPasswordPolicyError("abcdefgh") ?? "", /número/);
  assert.equal(getPasswordPolicyError("abcdefg1"), null);
});

test("generates passwords that satisfy the policy", () => {
  for (let index = 0; index < 20; index += 1) {
    assert.equal(getPasswordPolicyError(generateTemporaryPassword()), null);
  }
});

test("performs basic server-side email validation", () => {
  assert.equal(isValidEmail("ana@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("a @example.com"), false);
});

