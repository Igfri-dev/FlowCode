import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FlowProgram, FlowEditorNode, FlowEditorEdge } from "@/types/flow";
import {
  evaluateExpression,
  resetFlowExecution,
  stepFlowExecution,
  type ExecutionVariables,
  type FlowExecutionState,
} from "@/features/flow/execution";
import { generateJavaScriptFromFlow } from "@/features/flow/codegen";
import { getExercises } from "@/features/exercises/data/exercises";
import { validateFlowDiagram } from "@/features/flow/flow-validation";
import { importJavaScriptToFlow } from "@/features/flow/parser";

describe("Flow expression runtime", () => {
  it("supports the expanded Math whitelist and Math.PI", () => {
    assertExpressionValue("Math.abs(-7)", 7);
    assertExpressionValue("Math.floor(2.9)", 2);
    assertExpressionValue("Math.ceil(2.1)", 3);
    assertExpressionValue("Math.round(2.5)", 3);
    assertExpressionValue("Math.trunc(-2.9)", -2);
    assertExpressionValue("Math.pow(2, 4)", 16);
    assertExpressionValue("Math.sqrt(9)", 3);
    assertExpressionValue("Math.sin(0)", 0);
    assertExpressionValue("Math.cos(0)", 1);
    assert.ok(Math.abs(getExpressionNumber("Math.tan(0)")) < 0.000001);
    assert.ok(Math.abs(getExpressionNumber("Math.PI") - Math.PI) < 0.000001);

    for (let index = 0; index < 12; index += 1) {
      const value = getExpressionNumber("Math.random()");

      assert.ok(value >= 0);
      assert.ok(value < 1);
    }

    const invalidSqrt = evaluateExpression('Math.sqrt("9")', {});

    assert.equal(invalidSqrt.ok, false);
    assert.match(invalidSqrt.message, /numericos/);
  });

  it("supports string properties, methods and index access", () => {
    assertExpressionValue('"".length', 0);
    assertExpressionValue('"  hola  ".trim()', "hola");
    assertExpressionValue('"abc".toUpperCase()', "ABC");
    assertExpressionValue('"ABC".toLowerCase()', "abc");
    assertExpressionValue('"flowcode".includes("code")', true);
    assertExpressionValue('"flowcode".startsWith("flow")', true);
    assertExpressionValue('"flowcode".endsWith("code")', true);
    assertExpressionValue('"abcdef".slice(1, 4)', "bcd");
    assertExpressionValue('"abcdef".substring(4, 1)', "bcd");
    assertExpressionValue('"uno uno".replace("uno", "dos")', "dos uno");
    assertExpressionValue('"a,b,c".split(",")', ["a", "b", "c"]);
    assertExpressionValue('"abc"[1]', "b");
    assertExpressionValue('"abc"[9]', undefined);
  });

  it("supports basic array methods with process side effects", () => {
    const state = runInstructions([
      "let arr = [1, 2]",
      "pushLength = arr.push(3)",
      "popped = arr.pop()",
      "unshiftLength = arr.unshift(0)",
      "shifted = arr.shift()",
      "hasTwo = arr.includes(2)",
      "twoIndex = arr.indexOf(2)",
      "copy = arr.slice(0, 2)",
      'joined = arr.join("-")',
    ]);

    assert.equal(state.status, "finished");
    assert.deepEqual(state.variables.arr, [1, 2]);
    assert.equal(state.variables.pushLength, 3);
    assert.equal(state.variables.popped, 3);
    assert.equal(state.variables.unshiftLength, 3);
    assert.equal(state.variables.shifted, 0);
    assert.equal(state.variables.hasTwo, true);
    assert.equal(state.variables.twoIndex, 1);
    assert.deepEqual(state.variables.copy, [1, 2]);
    assert.equal(state.variables.joined, "1-2");
  });

  it("supports advanced array callbacks", () => {
    assertExpressionValue("[1, 2, 3].map(x => x * 2)", [2, 4, 6]);
    assertExpressionValue("[1, 2, 3, 4].filter(x => x % 2 === 0)", [2, 4]);
    assertExpressionValue("[1, 2, 3].find(x => x > 1)", 2);
    assertExpressionValue("[1, 2, 3].some(x => x > 2)", true);
    assertExpressionValue("[1, 2, 3].every(x => x > 0)", true);
    assertExpressionValue("[1, 2, 3].reduce((total, x) => total + x, 0)", 6);
    assertExpressionValue("[3, 1, 2].sort((a, b) => a - b)", [1, 2, 3]);
    assertExpressionValue("[10, 2, 1].sort()", [1, 10, 2]);

    const emptyReduce = evaluateExpression(
      "[].reduce((total, x) => total + x)",
      {},
    );

    assert.equal(emptyReduce.ok, false);
    assert.match(emptyReduce.message, /valor inicial/);
  });

  it("supports object access, dynamic access, assignment and Object helpers", () => {
    const state = runInstructions([
      "let obj = { a: 1 }",
      "obj.b = 2",
      'obj["c"] = 3',
      "a = obj.a",
      'b = obj["b"]',
      "missing = obj.noExiste",
      "keys = Object.keys(obj)",
      "values = Object.values(obj)",
      "entries = Object.entries(obj)",
    ]);

    assert.equal(state.status, "finished");
    assert.deepEqual(state.variables.obj, { a: 1, b: 2, c: 3 });
    assert.equal(state.variables.a, 1);
    assert.equal(state.variables.b, 2);
    assert.equal(state.variables.missing, undefined);
    assert.deepEqual(state.variables.keys, ["a", "b", "c"]);
    assert.deepEqual(state.variables.values, [1, 2, 3]);
    assert.deepEqual(state.variables.entries, [
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("supports character and Unicode helpers with useful validation", () => {
    assertExpressionValue('charAt("abc", 1)', "b");
    assertExpressionValue('charAt("abc", 9)', "");
    assertExpressionValue('charToCode("A")', 65);
    assertExpressionValue("codeToChar(65)", "A");
    assertExpressionValue('charCodeAt("ABC", 0)', 65);
    assertExpressionValue('codePointAt("😀", 0)', 128512);
    assertExpressionValue("fromCharCode(65)", "A");
    assertExpressionValue("fromCodePoint(128512)", "😀");
    assertExpressionValue('charToCode("😀")', 128512);

    const emptyCharacter = evaluateExpression('charToCode("")', {});
    const multiCharacter = evaluateExpression('charToCode("ab")', {});
    const invalidCodePoint = evaluateExpression("fromCodePoint(-1)", {});

    assert.equal(emptyCharacter.ok, false);
    assert.match(emptyCharacter.message, /vacio/);
    assert.equal(multiCharacter.ok, false);
    assert.match(multiCharacter.message, /exactamente un caracter/);
    assert.equal(invalidCodePoint.ok, false);
    assert.match(invalidCodePoint.message, /Unicode entero/);
  });

  it("keeps unsafe dynamic execution blocked", () => {
    const evalResult = evaluateExpression('eval("1 + 1")', {});
    const functionResult = evaluateExpression('Function("return 1")()', {});

    assert.equal(evalResult.ok, false);
    assert.match(evalResult.message, /no esta permitida/);
    assert.equal(functionResult.ok, false);
    assert.match(functionResult.message, /no permitida|no soportada/);
  });
});

describe("JavaScript import parser", () => {
  it("preserves array callbacks inside process blocks without new node types", () => {
    const result = importJavaScriptToFlow(`
      let numeros = [1, 2, 3];
      let dobles = numeros.map(x => x * 2);
      let pares = numeros.filter(function (x) { return x % 2 === 0; });
    `);

    assert.equal(result.ok, true);

    const processInstructions = result.nodes
      .filter((node) => node.type === "process")
      .map((node) =>
        "instruction" in node.data.config ? node.data.config.instruction : "",
      );

    assert.ok(processInstructions.includes("let numeros = [1, 2, 3]"));
    assert.ok(processInstructions.includes("let dobles = numeros.map(x => x * 2)"));
    assert.ok(
      processInstructions.includes(
        "let pares = numeros.filter(function(x) { return x % 2 === 0; })",
      ),
    );
    assert.equal(result.nodes.some((node) => node.type === "process"), true);
  });

  it("imports every exercise starter code in every supported language", () => {
    const exercisesWithCode = ["es", "en"].flatMap((language) =>
      getExercises(language as "es" | "en")
        .filter((exercise) => exercise.starterCode)
        .map((exercise) => ({
          ...exercise,
          language,
        })),
    );

    for (const exercise of exercisesWithCode) {
      const result = importJavaScriptToFlow(exercise.starterCode ?? "");

      assert.equal(
        result.ok,
        true,
        result.ok ? "" : `${exercise.language}/${exercise.id}: ${result.message}`,
      );
    }
  });
});

describe("Flow JavaScript code generation", () => {
  it("infers a for loop from initializer, condition and update blocks", () => {
    const nodes = [
      createNode("start", "start", "Inicio", {}),
      createNode("init", "process", "let i = 1", {
        instruction: "let i = 1",
      }),
      createNode("condition", "decision", "i <= 3", {
        condition: "i <= 3",
      }),
      createNode("print", "output", "Mostrar i", {
        expression: "i",
        outputMode: "expression",
      }),
      createNode("update", "process", "i++", { instruction: "i++" }),
      createNode("end", "end", "Fin", {}),
    ];
    const edges = [
      createEdge("start", "init", "out"),
      createEdge("init", "condition", "out"),
      createEdge("condition", "print", "yes"),
      createEdge("print", "update", "out"),
      createEdge("update", "condition", "out"),
      createEdge("condition", "end", "no"),
    ];

    const result = generateJavaScriptFromFlow({ nodes, edges });

    assert.deepEqual(result.warnings, []);
    assert.match(result.code, /for \(let i = 1; i <= 3; i\+\+\) \{/);
    assert.doesNotMatch(result.code, /while \(i <= 3\)/);
  });

  it("infers a for loop when other setup blocks appear before the condition", () => {
    const nodes = [
      createNode("start", "start", "Inicio", {}),
      createNode("init", "process", "let i = 0", {
        instruction: "let i = 0",
      }),
      createNode("setup", "process", "let suma = 0", {
        instruction: "let suma = 0",
      }),
      createNode("condition", "decision", "i < 5", {
        condition: "i < 5",
      }),
      createNode("body", "process", "suma = suma + i", {
        instruction: "suma = suma + i",
      }),
      createNode("update", "process", "i++", { instruction: "i++" }),
      createNode("print", "output", "Mostrar suma", {
        expression: "suma",
        outputMode: "expression",
      }),
      createNode("end", "end", "Fin", {}),
    ];
    const edges = [
      createEdge("start", "init", "out"),
      createEdge("init", "setup", "out"),
      createEdge("setup", "condition", "out"),
      createEdge("condition", "body", "yes"),
      createEdge("body", "update", "out"),
      createEdge("update", "condition", "out"),
      createEdge("condition", "print", "no"),
      createEdge("print", "end", "out"),
    ];

    const result = generateJavaScriptFromFlow({ nodes, edges });

    assert.deepEqual(result.warnings, []);
    assert.match(result.code, /let suma = 0;\n\s+for \(let i = 0; i < 5; i\+\+\) \{/);
    assert.doesNotMatch(result.code, /while \(i < 5\)/);
  });

  it("uses do while for a cycle that evaluates the condition after the body", () => {
    const nodes = [
      createNode("start", "start", "Inicio", {}),
      createNode("step", "process", "i++", { instruction: "i++" }),
      createNode("condition", "decision", "i < 3", {
        condition: "i < 3",
      }),
      createNode("end", "end", "Fin", {}),
    ];
    const edges = [
      createEdge("start", "step", "out"),
      createEdge("step", "condition", "out"),
      createEdge("condition", "step", "yes"),
      createEdge("condition", "end", "no"),
    ];

    const result = generateJavaScriptFromFlow({ nodes, edges });

    assert.deepEqual(result.warnings, []);
    assert.match(result.code, /do \{\n\s+i\+\+;\n\s+\} while \(i < 3\);/);
    assert.doesNotMatch(result.code, /while \(i < 3\) \{/);
  });

  it("keeps a block-scoped for initializer visible after the loop when needed", () => {
    const nodes = [
      createNode("start", "start", "Inicio", {}),
      createNode("init", "process", "let i = 1", {
        instruction: "let i = 1",
      }),
      createNode("condition", "decision", "i <= 3", {
        condition: "i <= 3",
      }),
      createNode("body", "process", "total += i", {
        instruction: "total += i",
      }),
      createNode("update", "process", "i++", { instruction: "i++" }),
      createNode("after", "output", "Mostrar i", {
        expression: "i",
        outputMode: "expression",
      }),
      createNode("end", "end", "Fin", {}),
    ];
    const edges = [
      createEdge("start", "init", "out"),
      createEdge("init", "condition", "out"),
      createEdge("condition", "body", "yes"),
      createEdge("body", "update", "out"),
      createEdge("update", "condition", "out"),
      createEdge("condition", "after", "no"),
      createEdge("after", "end", "out"),
    ];

    const result = generateJavaScriptFromFlow({ nodes, edges });

    assert.deepEqual(result.warnings, []);
    assert.match(result.code, /let i = 1;\n\s+for \(; i <= 3; i\+\+\) \{/);
  });

  it("infers switch from a chain of strict equality decisions", () => {
    const nodes = [
      createNode("start", "start", "Inicio", {}),
      createNode("sum-condition", "decision", 'operacion === "+"', {
        condition: 'operacion === "+"',
      }),
      createNode("subtract-condition", "decision", 'operacion === "-"', {
        condition: 'operacion === "-"',
      }),
      createNode("sum", "process", "resultado = a + b", {
        instruction: "resultado = a + b",
      }),
      createNode("subtract", "process", "resultado = a - b", {
        instruction: "resultado = a - b",
      }),
      createNode("fallback", "process", "resultado = 0", {
        instruction: "resultado = 0",
      }),
      createNode("print", "output", "Mostrar resultado", {
        expression: "resultado",
        outputMode: "expression",
      }),
      createNode("end", "end", "Fin", {}),
    ];
    const edges = [
      createEdge("start", "sum-condition", "out"),
      createEdge("sum-condition", "sum", "yes"),
      createEdge("sum-condition", "subtract-condition", "no"),
      createEdge("subtract-condition", "subtract", "yes"),
      createEdge("subtract-condition", "fallback", "no"),
      createEdge("sum", "print", "out"),
      createEdge("subtract", "print", "out"),
      createEdge("fallback", "print", "out"),
      createEdge("print", "end", "out"),
    ];

    const result = generateJavaScriptFromFlow({ nodes, edges });

    assert.deepEqual(result.warnings, []);
    assert.match(result.code, /switch \(operacion\) \{/);
    assert.match(result.code, /case "\+":/);
    assert.match(result.code, /case "-":/);
    assert.match(result.code, /default:/);
    assert.doesNotMatch(result.code, /if \(operacion ===/);
  });
});

describe("Flow semantic validation", () => {
  it("reports unsafe calls in existing textual process blocks", () => {
    const program = createInstructionProgram(['eval("1 + 1")']);
    const issues = validateFlowDiagram({
      nodes: program.main.nodes,
      edges: program.main.edges,
    });

    assert.ok(
      issues.some((issue) =>
        issue.message.includes('La llamada "eval(...)" no esta permitida'),
      ),
    );
  });
});

function assertExpressionValue(
  expression: string,
  expected: unknown,
  variables: ExecutionVariables = {},
) {
  const result = evaluateExpression(expression, variables);

  assert.equal(result.ok, true, result.ok ? "" : result.message);
  assert.deepEqual(result.value, expected);
}

function getExpressionNumber(expression: string) {
  const result = evaluateExpression(expression, {});

  if (!result.ok) {
    assert.fail(result.message);
  }

  if (typeof result.value !== "number") {
    assert.fail(`Expected number from ${expression}, got ${typeof result.value}.`);
  }

  return result.value;
}

function runInstructions(instructions: string[]) {
  const program = createInstructionProgram(instructions);
  let state: FlowExecutionState = resetFlowExecution();

  while (state.status !== "finished" && state.status !== "error") {
    state = stepFlowExecution({
      program,
      activeDiagramId: "main",
      state,
    });
  }

  return state;
}

function createInstructionProgram(instructions: string[]): FlowProgram {
  const startNode = createNode("start", "start", "Inicio", {});
  const processNodes = instructions.map((instruction, index) =>
    createNode(`process-${index}`, "process", instruction, { instruction }),
  );
  const endNode = createNode("end", "end", "Fin", {});
  const nodes = [startNode, ...processNodes, endNode];
  const edges = nodes.slice(0, -1).map((node, index) =>
    createEdge(node.id, nodes[index + 1].id, index === 0 ? "out" : "out"),
  );

  return {
    main: {
      nodes,
      edges,
    },
    functions: [],
  };
}

function createNode(
  id: string,
  type: FlowEditorNode["type"],
  label: string,
  config: FlowEditorNode["data"]["config"],
): FlowEditorNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      label,
      config,
      onLabelChange: () => undefined,
      onConfigChange: () => undefined,
      onHandlePositionsChange: () => undefined,
    },
  } as FlowEditorNode;
}

function createEdge(
  source: string,
  target: string,
  sourceHandle: string,
): FlowEditorEdge {
  return {
    id: `${source}-${target}`,
    type: "flow",
    source,
    target,
    sourceHandle,
    targetHandle: "in",
  };
}
