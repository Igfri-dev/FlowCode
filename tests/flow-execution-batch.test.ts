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

  it("yields at each nested call and return when following diagrams", () => {
    const program = importProgram(
      "function inner(value) { return value * 2; } " +
      "function outer(value) { let doubled = inner(value); return doubled + 1; } " +
      "let answer = outer(3); console.log(answer);",
    );
    const inner = program.functions.find((item) => item.name === "inner")!;
    const outer = program.functions.find((item) => item.name === "outer")!;
    const enteringOuter = runUntilDiagramChange(program);
    assert.equal(enteringOuter.currentDiagramId, outer.id);
    assert.equal(enteringOuter.currentNodeId, outer.nodes.find((node) => node.type === "start")!.id);
    assert.equal(enteringOuter.callStack.length, 1);
    assert.equal(enteringOuter.history.at(-1)?.nodeType, "functionCall");

    const enteringInner = runUntilDiagramChange(program, enteringOuter);
    assert.equal(enteringInner.currentDiagramId, inner.id);
    assert.equal(enteringInner.currentNodeId, inner.nodes.find((node) => node.type === "start")!.id);
    assert.equal(enteringInner.callStack.length, 2);
    assert.equal(enteringInner.history.at(-1)?.nodeType, "functionCall");

    const returningToOuter = runUntilDiagramChange(program, enteringInner);
    assert.equal(returningToOuter.currentDiagramId, outer.id);
    assert.equal(returningToOuter.currentNodeId, outer.nodes.find((node) => node.type === "return")!.id);
    assert.equal(returningToOuter.variables.doubled, 6);
    assert.equal(returningToOuter.callStack.length, 1);
    assert.equal(returningToOuter.history.at(-1)?.nodeType, "return");

    const returningToMain = runUntilDiagramChange(program, returningToOuter);
    assert.equal(returningToMain.currentDiagramId, "main");
    assert.equal(returningToMain.variables.answer, 7);
    assert.equal(returningToMain.callStack.length, 0);
    assert.equal(returningToMain.history.at(-1)?.nodeType, "return");
    assert.equal(returningToMain.outputs.length, 0);

    const state = runUntilDiagramChange(program, returningToMain);
    assert.equal(state.status, "finished");
    assert.deepEqual(state.outputs.map((item) => item.content), ["7"]);
  });

  it("keeps completing nested calls in one batch by default", () => {
    const program = importProgram(
      "function inner(value) { return value * 2; } " +
      "function outer(value) { let doubled = inner(value); return doubled + 1; } " +
      "let answer = outer(3); console.log(answer);",
    );
    const state = runFlowExecutionBatch({
      program,
      activeDiagramId: "main",
      state: resetFlowExecution(),
      now: () => 0,
    });
    assert.equal(state.status, "finished");
    assert.equal(state.currentDiagramId, "main");
    assert.equal(state.callStack.length, 0);
    assert.deepEqual(state.outputs.map((item) => item.content), ["7"]);
  });

  it("keeps recursive calls on the same diagram until returning to the caller", () => {
    const program = importProgram(
      "function sum(value) { if (value <= 0) { return 0; } " +
      "let rest = sum(value - 1); return value + rest; } " +
      "let answer = sum(3); console.log(answer);",
    );
    const entered = runUntilDiagramChange(program);
    assert.equal(entered.currentDiagramId, program.functions[0].id);
    const returned = runUntilDiagramChange(program, entered);
    assert.equal(returned.currentDiagramId, "main");
    assert.equal(returned.variables.answer, 6);
    assert.equal(returned.callStack.length, 0);
    assert.equal(returned.history.filter((item) => item.nodeType === "functionCall").length, 4);
    assert.equal(returned.history.filter((item) => item.nodeType === "return").length, 4);
    const state = runUntilDiagramChange(program, returned);
    assert.equal(state.status, "finished");
    assert.deepEqual(state.outputs.map((item) => item.content), ["6"]);
  });

  it("yields when a function ends without an explicit return", () => {
    const program = importProgram(
      'function announce() { console.log("inside"); } announce(); console.log("outside");',
    );
    const entered = runUntilDiagramChange(program);
    assert.equal(entered.currentDiagramId, program.functions[0].id);
    const returned = runUntilDiagramChange(program, entered);
    assert.equal(returned.currentDiagramId, "main");
    assert.equal(returned.history.at(-1)?.nodeType, "end");
    assert.equal(returned.callStack.length, 0);
    assert.deepEqual(returned.outputs.map((item) => item.content), ["inside"]);
    const state = runUntilDiagramChange(program, returned);
    assert.equal(state.status, "finished");
    assert.deepEqual(state.outputs.map((item) => item.content), ["inside", "outside"]);
  });

  it("keeps waiting input in its called function before returning to its caller", () => {
    const program = importProgram(
      "function read() { let value = 0; return value; } let answer = read(); console.log(answer);",
    );
    const calledFunction = program.functions[0];
    calledFunction.nodes = calledFunction.nodes.map((node) =>
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
    const entered = runUntilDiagramChange(program);
    const waiting = runUntilDiagramChange(program, entered);
    assert.equal(waiting.status, "waitingInput");
    assert.equal(waiting.currentDiagramId, calledFunction.id);
    assert.equal(waiting.callStack.length, 1);
    assert.strictEqual(runUntilDiagramChange(program, waiting), waiting);
    const resumed = resumeFlowExecutionWithInput({ state: waiting, value: 42 });
    const returned = runUntilDiagramChange(program, resumed);
    assert.equal(returned.currentDiagramId, "main");
    assert.equal(returned.variables.answer, 42);
    const state = runUntilDiagramChange(program, returned);
    assert.equal(state.status, "finished");
    assert.deepEqual(state.outputs.map((item) => item.content), ["42"]);
  });
});

function runUntilDiagramChange(
  program: FlowProgram,
  state = resetFlowExecution(),
): FlowExecutionState {
  return runFlowExecutionBatch({
    program,
    activeDiagramId: "main",
    state,
    stopAtDiagramChange: true,
    now: () => 0,
  });
}

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
