import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inheritTestRequirements,
  resolveExerciseTestCases,
} from "@/lib/exercise-test-policy";
import type { ExerciseTestCase } from "@/lib/flow-test-runner";

describe("authoritative exercise test policies", () => {
  const reference: ExerciseTestCase[] = [
    { expectedOutputs: ["one"], requirements: ["loop", "decision"] },
    { expectedOutputs: ["two"], requirements: ["loop"] },
  ];

  it("retains custom expected outputs and inputs while upgrading legacy requirements", () => {
    const stored: ExerciseTestCase[] = [
      {
        name: "changed case",
        inputs: [9],
        expectedOutputs: ["teacher output"],
      },
    ];
    assert.deepEqual(inheritTestRequirements(stored, reference), [
      { ...stored[0], requirements: ["loop", "decision"] },
    ]);
    assert.equal(stored[0].requirements, undefined);
  });

  it("lets a teacher explicitly replace or disable inherited requirements", () => {
    const stored: ExerciseTestCase[] = [
      { expectedOutputs: ["custom"], requirements: ["function"] },
      { expectedOutputs: ["no techniques"], requirements: [] },
    ];
    assert.deepEqual(inheritTestRequirements(stored, reference), stored);
  });

  it("applies common requirements to additional teacher test cases", () => {
    const stored = ["first", "second", "extra"].map((output) => ({
      expectedOutputs: [output],
    }));
    assert.deepEqual(
      inheritTestRequirements(stored, reference).map(
        (testCase) => testCase.requirements,
      ),
      [["loop", "decision"], ["loop"], ["loop"]],
    );
  });

  it("does not invent requirements for custom or unknown exercises", () => {
    const stored = [{ expectedOutputs: ["custom"] }];
    assert.deepEqual(
      resolveExerciseTestCases({ sourceId: null, storedTestCases: stored }),
      stored,
    );
    assert.deepEqual(
      resolveExerciseTestCases({
        sourceId: "unrecognized-source",
        storedTestCases: stored,
      }),
      stored,
    );
  });

  it("restores source tests and technique requirements when a legacy override has no tests", () => {
    for (const language of ["es", "en"] as const) {
      const testCases = resolveExerciseTestCases({
        sourceId: "count-1-to-5",
        storedTestCases: [],
        language,
      });
      assert.equal(testCases.length, 1);
      assert.deepEqual(testCases[0].expectedOutputs, ["1", "2", "3", "4", "5"]);
      assert.ok(testCases[0].requirements?.includes("loop"));
    }
  });

  it("inherits source requirements for legacy stored tests in both languages", () => {
    for (const language of ["es", "en"] as const) {
      const testCases = resolveExerciseTestCases({
        sourceId: "even-number",
        storedTestCases: [{ expectedOutputs: ["teacher parity text"] }],
        language,
      });
      assert.equal(testCases[0].expectedOutputs[0], "teacher parity text");
      assert.ok(testCases[0].requirements?.includes("decision"));
      assert.ok(testCases[0].requirements?.includes("modulo"));
    }
  });
});
