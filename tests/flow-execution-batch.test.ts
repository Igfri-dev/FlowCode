import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canContinueFlowExecution,
  runFlowExecutionBatch,
} from "@/features/flow/execution-batch";
import {
  resetFlowExecution,
  resumeFlowExecutionWithInput,
  resumeFlowExecutionWithFunctionParameters,
  type FlowExecutionState,
} from "@/features/flow/execution";
import { importJavaScriptToFlow } from "@/features/flow/parser";
import type { FlowProgram } from "@/types/flow";

describe("Instant and unlimited flow execution", () => {
  it("finishes well beyond the former editor and exercise step limits", () => {
    const program = importProgram(
      "let total = 0; for (let i = 0; i < 1200; i++) { total += i; } console.log(total);",
    );
    const state = finish(program);
    assert.equal(state.maxSteps, null);
    assert.equal(state.status, "finished");
    assert.ok(state.stepCount > 1000);
    assert.equal(state.outputs[0].content, "719400");
  });

  it("yields a nonterminating program without marking it as failed", () => {
    const program = importProgram("let i = 0; while (true) { i++; }");
    let clock = 0;
    const now = () => clock++;
    const first = runFlowExecutionBatch({
      program,
      activeDiagramId: "main",
      state: resetFlowExecution(),
      timeBudgetMs: 3,
      now,
    });
    assert.equal(first.status, "running");
    assert.ok(first.stepCount > 0 && first.stepCount < 20);
    const second = runFlowExecutionBatch({
      program,
      activeDiagramId: "main",
      state: first,
      timeBudgetMs: 3,
      now,
    });
    assert.equal(second.status, "running");
    assert.ok(second.stepCount > first.stepCount);
  });

  it("still honors an explicit finite evaluation limit", () => {
    const program = importProgram("while (true) { let x = 1; }");
    const state = runFlowExecutionBatch({
      program,
      activeDiagramId: "main",
      state: { ...resetFlowExecution(), maxSteps: 12 },
      now: () => 0,
    });
    assert.equal(state.status, "error");
    assert.equal(state.stepCount, 12);
    assert.match(state.message, /limite de 12 pasos/);
  });

  it("waits for input and resumes from the same variables and position", () => {
    const program = importProgram("let value = 0; console.log(value * 2);");
    program.main.nodes = program.main.nodes.map((node) =>
      node.type === "process"
        ? {
            ...node,
            type: "input",
            data: {
              ...node.data,
              config: {
                variableName: "value",
                prompt: "Valor",
                inputType: "number",
              },
            },
          }
        : node,
    );
    const waiting = runFlowExecutionBatch({
      program,
      activeDiagramId: "main",
      state: resetFlowExecution(),
      now: () => 0,
    });
    assert.equal(waiting.status, "waitingInput");
    assert.strictEqual(
      runFlowExecutionBatch({
        program,
        activeDiagramId: "main",
        state: waiting,
      }),
      waiting,
    );
    const state = finish(
      program,
      resumeFlowExecutionWithInput({ state: waiting, value: 7 }),
    );
    assert.equal(state.status, "finished");
    assert.equal(state.outputs[0].content, "14");
  });

  it("waits for standalone function parameters and records the return output", () => {
    const program = importProgram(
      "function triple(value) { return value * 3; }",
    );
    const functionId = program.functions[0].id;
    const waiting = runFlowExecutionBatch({
      program,
      activeDiagramId: functionId,
      state: resetFlowExecution(functionId, "Funcion triple"),
      now: () => 0,
    });
    assert.equal(waiting.status, "waitingFunctionParameters");
    const resumed = resumeFlowExecutionWithFunctionParameters({
      state: waiting,
      values: { value: 7 },
    });
    const state = finish(program, resumed, functionId);
    assert.equal(state.status, "finished");
    assert.equal(state.outputs[0].content, "return 21");
    assert.equal(state.outputCount, 1);
  });

  it("keeps recent records bounded without losing totals or visited blocks", () => {
    const program = importProgram(
      "for (let i = 0; i < 40; i++) { console.log(i); }",
    );
    const state = finish(program, {
      ...resetFlowExecution(),
      historyLimit: 5,
      outputLimit: 3,
    });
    assert.equal(state.status, "finished");
    assert.equal(state.history.length, 5);
    assert.ok(state.stepCount > state.history.length);
    assert.equal(state.outputCount, 40);
    assert.deepEqual(
      state.outputs.map((output) => output.content),
      ["37", "38", "39"],
    );
    assert.ok(
      state.visitedNodeIds.main.includes(
        program.main.nodes.find((node) => node.type === "start")!.id,
      ),
    );
    assert.ok(state.visitedEdgeIds.main.includes(program.main.edges[0].id));
    const one = finish(program, {
      ...resetFlowExecution(),
      historyLimit: 1,
      outputLimit: 1,
    });
    assert.equal(one.history.length, 1);
    assert.deepEqual(
      one.outputs.map((output) => output.content),
      ["39"],
    );
  });

  it("stops immediately at a runtime error even after producing output", () => {
    const state = finish(
      importProgram("console.log(1); console.log(missing);"),
    );
    assert.equal(state.status, "error");
    assert.deepEqual(
      state.outputs.map((output) => output.content),
      ["1"],
    );
    assert.match(state.message, /missing/);
  });

  it("remembers a function return connection in its caller after history is trimmed", () => {
    const program = importProgram(
      "function plusOne(value) { return value + 1; } let answer = plusOne(2); console.log(answer);",
    );
    const state = finish(program, { ...resetFlowExecution(), historyLimit: 1 });
    const call = program.main.nodes.find(
      (node) => node.type === "functionCall",
    )!;
    const returnEdge = program.main.edges.find(
      (edge) => edge.source === call.id,
    )!;
    assert.equal(state.outputs[0].content, "3");
    assert.ok(state.visitedEdgeIds.main.includes(returnEdge.id));
    assert.ok(
      state.visitedNodeIds[program.functions[0].id].includes(
        program.functions[0].nodes.find((node) => node.type === "return")!.id,
      ),
    );
  });
});

function finish(
  program: FlowProgram,
  initial = resetFlowExecution(),
  activeDiagramId = "main",
): FlowExecutionState {
  let state = initial;
  for (let batch = 0; batch < 100 && canContinueFlowExecution(state); batch++) {
    state = runFlowExecutionBatch({
      program,
      activeDiagramId,
      state,
      now: () => 0,
    });
  }
  assert.ok(
    !canContinueFlowExecution(state),
    "Expected the fixture to terminate",
  );
  return state;
}

function importProgram(code: string): FlowProgram {
  const result = importJavaScriptToFlow(code);
  assert.ok(result.ok, result.ok ? "" : result.message);
  return {
    main: {
      nodes: result.nodes as FlowProgram["main"]["nodes"],
      edges: result.edges,
    },
    functions: result.functions as FlowProgram["functions"],
  };
}
