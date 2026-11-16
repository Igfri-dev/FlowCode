import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getExercises } from "@/features/exercises/data/exercises";
import { importJavaScriptToFlow } from "@/features/flow/parser";
import {
  parseExerciseTestCases,
  runFlowProgramTests,
} from "@/lib/flow-test-runner";
import type { FlowProgram } from "@/types/flow";

function programFromCode(code: string): FlowProgram {
  const imported = importJavaScriptToFlow(code);
  assert.ok(imported.ok, imported.ok ? "" : imported.message);
  return {
    main: { nodes: imported.nodes, edges: imported.edges },
    functions: imported.functions,
  } as unknown as FlowProgram;
}

describe("exercise technique policy", () => {
  for (const language of ["es", "en"] as const) {
    for (const exercise of getExercises(language)) {
      it(`accepts the reference solution for ${language}/${exercise.id}`, () => {
        assert.ok(exercise.starterCode);
        assert.ok(exercise.testCases?.length);
        assert.ok(
          exercise.testCases.every((test) => test.requirements?.length),
          "Builtin tests need an explicit technique policy in both languages",
        );
        const result = runFlowProgramTests({
          program: programFromCode(exercise.starterCode),
          testCases: exercise.testCases,
        });
        assert.ok(
          result.passed,
          JSON.stringify(
            result.cases.filter((item) => !item.passed),
            null,
            2,
          ),
        );
      });
      it(`rejects printed answers without the techniques for ${language}/${exercise.id}`, () => {
        for (const testCase of exercise.testCases ?? []) {
          const literalAnswer = testCase.expectedOutputs
            .map((value) => `console.log(${JSON.stringify(value)});`)
            .join("\n");
          const result = runFlowProgramTests({
            program: programFromCode(literalAnswer),
            testCases: [testCase],
          });
          assert.equal(result.cases[0].outputsPassed, true);
          assert.equal(result.passed, false);
          assert.ok(
            result.cases[0].techniqueResults?.some((check) => !check.passed),
          );
        }
      });
    }
  }

  it("preserves and deduplicates teacher-defined requirements", () => {
    const cases = parseExerciseTestCases(
      JSON.stringify([
        {
          expectedOutputs: ["15"],
          requirements: ["loop", "accumulator", "loop"],
        },
      ]),
    );
    assert.deepEqual(cases[0].requirements, ["loop", "accumulator"]);
  });
  it("rejects misspelled or malformed requirements instead of silently bypassing them", () => {
    for (const requirements of [["not-a-technique"], "loop", null, [1], {}]) {
      assert.throws(
        () =>
          parseExerciseTestCases(
            JSON.stringify([{ expectedOutputs: [], requirements }]),
          ),
        /invalid technique requirements/,
      );
    }
  });
  it("retains the outputs-only behavior for custom cases without requirements", () => {
    const tests = parseExerciseTestCases('[{"expectedOutputs":["15"]}]');
    assert.equal(tests[0].requirements, undefined);
    assert.equal(
      runFlowProgramTests({
        program: programFromCode('console.log("15");'),
        testCases: tests,
      }).passed,
      true,
    );
  });
});
