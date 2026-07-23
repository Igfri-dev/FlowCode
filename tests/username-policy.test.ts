import assert from "node:assert/strict";
import test from "node:test";
import {
  getUsernamePolicyError,
  isReservedUsername,
} from "../src/lib/username-policy";

test("reserves administrator and system identities", () => {
  for (const username of [
    "admin",
    "Administrador",
    "administador",
    "administrator",
    "admin_01",
    "superadmin",
    "root2",
    "sístema",
  ]) {
    assert.equal(isReservedUsername(username), true, username);
    assert.match(getUsernamePolicyError(username) ?? "", /reservado/);
  }
});

test("allows ordinary usernames", () => {
  for (const username of ["ana", "profesor.martin", "estudiante_01"]) {
    assert.equal(isReservedUsername(username), false, username);
    assert.equal(getUsernamePolicyError(username), null);
  }
});
