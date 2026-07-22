import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canManageExerciseScope,
  getExerciseCreationOrganizationId,
  getExerciseScope,
} from "@/lib/exercise-scope";

describe("exercise catalog scope", () => {
  const admin = { role: "admin" as const, organizationId: null };
  const teacher = { role: "teacher" as const, organizationId: 10 };

  it("creates platform administrator exercises in the global catalog", () => {
    assert.equal(getExerciseCreationOrganizationId(admin), null);
    assert.equal(getExerciseScope(null), "global");
  });

  it("creates teacher exercises inside the teacher organization", () => {
    assert.equal(getExerciseCreationOrganizationId(teacher), 10);
    assert.equal(getExerciseScope(10), "organization");
  });

  it("only lets teachers manage exercises from their own organization", () => {
    assert.equal(canManageExerciseScope(teacher, 10), true);
    assert.equal(canManageExerciseScope(teacher, 11), false);
    assert.equal(canManageExerciseScope(teacher, null), false);
    assert.equal(canManageExerciseScope(admin, null), true);
    assert.equal(canManageExerciseScope(admin, 11), true);
  });
});
