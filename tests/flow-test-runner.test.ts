import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  importJavaScriptToFlow,
  type ImportedFlowNode,
} from "@/features/flow/parser";
import { runFlowProgramTests } from "@/lib/flow-test-runner";
import type { FlowEditorNode, FlowProgram } from "@/types/flow";

describe("Flow exercise test runner", () => {
  it("passes a program that finishes with the expected outputs", () => {
    const result = runFlowProgramTests({
      program: importProgram("console.log(1);"),
      testCases: [{ expectedOutputs: ["1"] }],
    });

    assert.equal(result.passed, true);
    assert.equal(result.passedCount, 1);
    assert.equal(result.cases[0].message, "Passed");
  });

  it("fails a runtime error after the expected output has been printed", () => {
    const result = runFlowProgramTests({
      program: importProgram("console.log(1); console.log(missingVariable);"),
      testCases: [{ expectedOutputs: ["1"] }],
    });

    assert.equal(result.passed, false);
    assert.equal(result.passedCount, 0);
    assert.deepEqual(result.cases[0].actualOutputs, ["1"]);
    assert.match(result.cases[0].message, /missingVariable/);
  });

  it("fails the step limit after the expected output has been printed", () => {
    const result = runFlowProgramTests({
      maxSteps: 10,
      program: importProgram("console.log(1); while (true) { let x = 1; }"),
      testCases: [{ expectedOutputs: ["1"] }],
    });

    assert.equal(result.passed, false);
    assert.equal(result.cases[0].passed, false);
    assert.deepEqual(result.cases[0].actualOutputs, ["1"]);
    assert.match(result.cases[0].message, /limite de 10 pasos/);
  });

  it("fails a nonterminating program when no outputs are expected", () => {
    const result = runFlowProgramTests({
      maxSteps: 10,
      program: importProgram("while (true) { let x = 1; }"),
      testCases: [{ expectedOutputs: [] }],
    });

    assert.equal(result.passed, false);
    assert.deepEqual(result.cases[0].actualOutputs, []);
    assert.match(result.cases[0].message, /limite de 10 pasos/);
  });

  it("explains an output mismatch after successful execution", () => {
    const result = runFlowProgramTests({
      program: importProgram("console.log(2);"),
      testCases: [{ expectedOutputs: ["1"] }],
    });

    assert.equal(result.passed, false);
    assert.deepEqual(result.cases[0].actualOutputs, ["2"]);
    assert.equal(
      result.cases[0].message,
      "Outputs do not match the expected outputs.",
    );
  });

  it("rejects invalid step limits instead of allowing an unbounded run", () => {
    const program = importProgram("console.log(1);");

    for (const maxSteps of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () =>
          runFlowProgramTests({
            maxSteps,
            program,
            testCases: [{ expectedOutputs: ["1"] }],
          }),
        /maxSteps must be a positive safe integer/,
      );
    }
  });
});

function importProgram(code: string): FlowProgram {
  const imported = importJavaScriptToFlow(code);
  if (!imported.ok) {
    assert.fail(imported.message);
  }

  return {
    main: {
      nodes: imported.nodes.map(createEditorNode),
      edges: imported.edges,
    },
    functions: imported.functions.map((flowFunction) => ({
      ...flowFunction,
      nodes: flowFunction.nodes.map(createEditorNode),
    })),
  };
}

function createEditorNode(node: ImportedFlowNode): FlowEditorNode {
  return {
    ...node,
    data: {
      ...node.data,
      onLabelChange: () => undefined,
      onConfigChange: () => undefined,
      onHandlePositionsChange: () => undefined,
    },
  };
}
