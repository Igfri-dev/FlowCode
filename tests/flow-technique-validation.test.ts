import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { importJavaScriptToFlow } from "@/features/flow/parser";
import { runFlowProgramTests } from "@/lib/flow-test-runner";
import type { ExerciseTechnique } from "@/lib/flow-technique-validation";
import type { FlowProgram } from "@/types/flow";

function check(
  code: string,
  requirements: ExerciseTechnique[],
  outputs: string[],
) {
  const imported = importJavaScriptToFlow(code);
  assert.ok(imported.ok, imported.ok ? "" : imported.message);
  const program = {
    main: { nodes: imported.nodes, edges: imported.edges },
    functions: imported.functions,
  } as unknown as FlowProgram;
  const result = runFlowProgramTests({
    program,
    testCases: [{ requirements, expectedOutputs: outputs }],
  }).cases[0];
  assert.equal(result.outputsPassed, true, JSON.stringify(result));
  return result;
}

describe("technique evidence follows executed data and control dependencies", () => {
  const bypasses: Array<[string, string, ExerciseTechnique[], string[]]> = [
    [
      "unused loop",
      'let i=0; while(i<5){i++;} console.log("15");',
      ["loop"],
      ["15"],
    ],
    [
      "unexecuted loop",
      'let i=10; while(i<5){console.log(i);i++;} console.log("15");',
      ["loop"],
      ["15"],
    ],
    [
      "unused function",
      'function compute(){let i=0;while(i<5){i++;}return i;} console.log("5");',
      ["function", "loop"],
      ["5"],
    ],
    [
      "unused returned value",
      'function compute(){return 15;} let answer=compute(); console.log("15");',
      ["function"],
      ["15"],
    ],
    [
      "overwritten loop result",
      "let i=0;let sum=0;while(i<5){sum+=i;i++;}sum=15;console.log(sum);",
      ["loop", "accumulator"],
      ["15"],
    ],
    [
      "irrelevant modulo",
      'let n=8;let unused=n%2;console.log("par");',
      ["modulo"],
      ["par"],
    ],
    [
      "dead conditional expression",
      "let n=8;console.log(false ? n%2 : 15);",
      ["modulo"],
      ["15"],
    ],
    [
      "dead logical expression",
      "let n=8;console.log(false && n%2);",
      ["modulo"],
      ["false"],
    ],
    [
      "identical arms",
      'let n=8;if(n%2===0){console.log("par");}else{console.log("par");}',
      ["decision"],
      ["par"],
    ],
    [
      "unused counter around literal answer",
      'let i=0;while(i<1){i++;console.log("15");}',
      ["accumulator"],
      ["15"],
    ],
  ];
  for (const [name, code, requirements, outputs] of bypasses) {
    it(`rejects ${name} even when outputs match`, () =>
      assert.equal(check(code, requirements, outputs).passed, false));
  }
  it("accepts a hand-drawn equivalent loop without importer control metadata", () => {
    const imported = importJavaScriptToFlow(
      "let i=1;while(i<=3){console.log(i);i++;}",
    );
    assert.ok(imported.ok);
    const program = {
      main: {
        nodes: imported.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            config: { ...node.data.config, controlFlow: undefined },
          },
        })),
        edges: imported.edges,
      },
      functions: [],
    } as unknown as FlowProgram;
    assert.equal(
      runFlowProgramTests({
        program,
        testCases: [
          { expectedOutputs: ["1", "2", "3"], requirements: ["loop"] },
        ],
      }).passed,
      true,
    );
  });
  it("accepts an accumulator whose computed value reaches the output", () => {
    assert.equal(
      check(
        "let n=5;let sum=0;let i=1;while(i<=n){sum+=i;i++;}console.log(sum);",
        ["loop", "accumulator"],
        ["15"],
      ).passed,
      true,
    );
  });
  it("accepts nested function return dependencies", () => {
    assert.equal(
      check(
        "function double(n){return n*2;}function compute(n){let x=double(n);return x+1;}let value=compute(7);console.log(value);",
        ["function"],
        ["15"],
      ).passed,
      true,
    );
  });
  it("accepts a one-iteration do-while but not a fake for marker without a cycle", () => {
    assert.equal(
      check(
        "let i=0;do{console.log(i);i++;}while(i<1);",
        ["loop", "doWhile"],
        ["0"],
      ).passed,
      true,
    );
    const imported = importJavaScriptToFlow(
      'let n=8;if(n>0){console.log("yes");}else{console.log("no");}',
    );
    assert.ok(imported.ok);
    const nodes = imported.nodes.map((node) =>
      node.type === "decision"
        ? {
            ...node,
            data: {
              ...node.data,
              config: {
                ...node.data.config,
                controlFlow: {
                  kind: "for",
                  init: "",
                  test: "n>0",
                  update: "",
                  initNodeIds: [],
                },
              },
            },
          }
        : node,
    );
    const result = runFlowProgramTests({
      program: {
        main: { nodes, edges: imported.edges },
        functions: [],
      } as unknown as FlowProgram,
      testCases: [{ expectedOutputs: ["yes"], requirements: ["for"] }],
    });
    assert.equal(result.passed, false);
  });
});
