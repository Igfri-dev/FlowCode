import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateFlowDiagram } from "@/features/flow/flow-validation";
import type {
  FlowEditorEdge,
  FlowEditorNode,
  FlowFunctionDefinition,
} from "@/types/flow";

describe("Flow structural validation", () => {
  it("reports disconnected, unterminated and unreachable blocks", () => {
    const issues = validateFlowDiagram({
      nodes: [
        createNode("start", "start", "Inicio", {}),
        createNode("end", "end", "Fin", {}),
        createNode("orphan", "process", "x = 1", { instruction: "x = 1" }),
      ],
      edges: [createEdge("start", "end")],
    });
    const messages = issues.map((issue) => issue.message);

    assertAllIssuesHaveSeverity(issues);
    assert.ok(messages.some((message) => message.includes("no tiene conexión de entrada")));
    assert.ok(messages.some((message) => message.includes("no tiene conexión de salida")));
    assert.ok(messages.some((message) => message.includes("no es alcanzable desde Inicio")));
  });

  it("reports missing, duplicated and ambiguous decision branches", () => {
    const issues = validateFlowDiagram({
      nodes: [
        createNode("start", "start", "Inicio", {}),
        createNode("decision", "decision", "x > 0", { condition: "x > 0" }),
        createOutputNode("yes-a", '"A"'),
        createOutputNode("yes-b", '"B"'),
        createNode("end", "end", "Fin", {}),
      ],
      edges: [
        createEdge("start", "decision"),
        createEdge("decision", "yes-a", "yes"),
        createEdge("decision", "yes-b", "yes"),
        createEdge("decision", "end", "out"),
        createEdge("yes-a", "end"),
        createEdge("yes-b", "end"),
      ],
    });
    const messages = issues.map((issue) => issue.message);

    assertAllIssuesHaveSeverity(issues);
    assert.ok(messages.some((message) => message.includes("necesita una rama No")));
    assert.ok(messages.some((message) => message.includes("más de una rama Sí")));
    assert.ok(messages.some((message) => message.includes("salida sin rama Sí/No")));
  });

  it("reports a warning for assigned calls to functions without a clear return path", () => {
    const functionWithoutReturn = createFunctionWithoutReturn();
    const issues = validateFlowDiagram({
      nodes: [
        createNode("start", "start", "Inicio", {}),
        createNode("call", "functionCall", "Llamar calcular", {
          functionId: "function-1",
          args: ["1", "2"],
          assignTo: "resultado",
        }),
        createNode("end", "end", "Fin", {}),
      ],
      edges: [
        createEdge("start", "call"),
        createEdge("call", "end"),
      ],
      functions: [functionWithoutReturn],
    });
    const warning = issues.find(
      (issue) => issue.id === "call-function-call-return-warning",
    );

    assertAllIssuesHaveSeverity(issues);
    assert.equal(warning?.severity, "warning");
    assert.match(warning?.message ?? "", /no tiene un camino claro hacia Retorno/);
    assert.doesNotMatch(warning?.message ?? "", /^Aviso:/);
  });

  it("reports an error for a process with two outgoing edges", () => {
    const issues = validateFlowDiagram({
      nodes: [
        createNode("start", "start", "Inicio", {}),
        createNode("process", "process", "x = 1", { instruction: "x = 1" }),
        createNode("end-a", "end", "Fin A", {}),
        createNode("end-b", "end", "Fin B", {}),
      ],
      edges: [
        createEdge("start", "process"),
        createEdge("process", "end-a"),
        createEdge("process", "end-b", "out-2"),
      ],
    });

    assertHasIssue(issues, "process-non-decision-multiple-outgoing", "error");
  });

  it("reports errors for input, output and functionCall with two outgoing edges", () => {
    for (const node of [
      createNode("input", "input", "Leer dato", {
        prompt: "Dato",
        variableName: "dato",
        inputType: "text",
      }),
      createOutputNode("output", "dato"),
      createNode("functionCall", "functionCall", "Llamar calcular", {
        functionId: "function-ok",
        args: [],
        assignTo: "",
      }),
    ]) {
      const issues = validateFlowDiagram({
        nodes: [
          createNode("start", "start", "Inicio", {}),
          node,
          createNode("end-a", "end", "Fin A", {}),
          createNode("end-b", "end", "Fin B", {}),
        ],
        edges: [
          createEdge("start", node.id),
          createEdge(node.id, "end-a"),
          createEdge(node.id, "end-b", "out-2"),
        ],
        functions: [createReturningFunction("function-ok", "calcular")],
      });

      assertHasIssue(
        issues,
        `${node.id}-non-decision-multiple-outgoing`,
        "error",
      );
    }
  });

  it("does not report an error for a valid decision with yes and no branches", () => {
    const issues = validateFlowDiagram({
      nodes: [
        createNode("start", "start", "Inicio", {}),
        createNode("decision", "decision", "x > 0", { condition: "x > 0" }),
        createOutputNode("yes", '"positivo"'),
        createOutputNode("no", '"no positivo"'),
        createNode("end", "end", "Fin", {}),
      ],
      edges: [
        createEdge("start", "decision"),
        createEdge("decision", "yes", "yes"),
        createEdge("decision", "no", "no"),
        createEdge("yes", "end"),
        createEdge("no", "end"),
      ],
    });

    assertAllIssuesHaveSeverity(issues);
    assert.deepEqual(
      issues.filter((issue) => issue.severity === "error"),
      [],
    );
  });

  it("reports function orphan blocks with the function name", () => {
    const issues = validateFlowDiagram({
      nodes: createValidMainNodes(),
      edges: createValidMainEdges(),
      functions: [
        {
          id: "function-orphan",
          name: "calcular",
          parameters: [],
          nodes: [
            createNode("fn-start", "start", "Inicio", {}),
            createNode("fn-return", "return", "Retornar total", {
              expression: "total",
            }),
            createNode("fn-orphan", "process", "x = 1", {
              instruction: "x = 1",
            }),
          ],
          edges: [createEdge("fn-start", "fn-return")],
        },
      ],
    });

    assertAllIssuesHaveSeverity(issues);
    assert.ok(
      issues.some(
        (issue) =>
          issue.severity === "error" &&
          issue.message.includes('En la función "calcular": el bloque Proceso "x = 1"'),
      ),
    );
  });

  it("does not mark return inside a function as return-in-main", () => {
    const issues = validateFlowDiagram({
      nodes: createValidMainNodes(),
      edges: createValidMainEdges(),
      functions: [createReturningFunction("function-ok", "calcular")],
    });

    assertAllIssuesHaveSeverity(issues);
    assert.equal(
      issues.some((issue) => issue.id.includes("return-in-main")),
      false,
    );
  });

  it("reports incomplete function decisions even when main is active", () => {
    const issues = validateFlowDiagram({
      nodes: createValidMainNodes(),
      edges: createValidMainEdges(),
      currentDiagramId: "main",
      functions: [
        {
          id: "function-decision",
          name: "decidir",
          parameters: [],
          nodes: [
            createNode("fn-start", "start", "Inicio", {}),
            createNode("fn-decision", "decision", "x > 0", {
              condition: "x > 0",
            }),
            createNode("fn-return", "return", "Retornar x", {
              expression: "x",
            }),
          ],
          edges: [
            createEdge("fn-start", "fn-decision"),
            createEdge("fn-decision", "fn-return", "yes"),
          ],
        },
      ],
    });

    assertAllIssuesHaveSeverity(issues);
    assert.ok(
      issues.some(
        (issue) =>
          issue.severity === "error" &&
          issue.message.includes('En la función "decidir"') &&
          issue.message.includes("necesita una rama No"),
      ),
    );
  });

  it("reports invalid function calls, main returns and function definitions", () => {
    const issues = validateFlowDiagram({
      nodes: [
        createNode("start", "start", "Inicio", {}),
        createNode("call", "functionCall", "Llamar calcular", {
          functionId: "function-1",
          args: ["1"],
          assignTo: "resultado",
        }),
        createNode("return-main", "return", "Retornar resultado", {
          expression: "resultado",
        }),
        createNode("end", "end", "Fin", {}),
      ],
      edges: [
        createEdge("start", "call"),
        createEdge("call", "return-main"),
      ],
      functions: [createFunctionWithoutReturn()],
    });
    const messages = issues.map((issue) => issue.message);

    assertAllIssuesHaveSeverity(issues);
    assert.ok(messages.some((message) => message.includes("espera al menos 2 argumento")));
    assert.ok(messages.some((message) => message.includes("solo debe usarse dentro de una funcion")));
    assert.equal(
      issues.find((issue) => issue.id === "call-function-call-args")?.severity,
      "error",
    );
    assert.equal(
      issues.find((issue) => issue.id === "call-function-call-return-warning")
        ?.severity,
      "warning",
    );
  });
});

function createValidMainNodes(): FlowEditorNode[] {
  return [
    createNode("start", "start", "Inicio", {}),
    createNode("end", "end", "Fin", {}),
  ];
}

function createValidMainEdges(): FlowEditorEdge[] {
  return [createEdge("start", "end")];
}

function createFunctionWithoutReturn(): FlowFunctionDefinition {
  return {
    id: "function-1",
    name: "calcular",
    parameters: ["x", "y"],
    nodes: [
      createNode("fn-start", "start", "Inicio", {}),
      createNode("fn-process", "process", "let total = x + y", {
        instruction: "let total = x + y",
      }),
      createNode("fn-end", "end", "Fin", {}),
    ],
    edges: [
      createEdge("fn-start", "fn-process"),
      createEdge("fn-process", "fn-end"),
    ],
  };
}

function createReturningFunction(
  id: string,
  name: string,
): FlowFunctionDefinition {
  return {
    id,
    name,
    parameters: [],
    nodes: [
      createNode(`${id}-start`, "start", "Inicio", {}),
      createNode(`${id}-return`, "return", "Retornar 1", {
        expression: "1",
      }),
    ],
    edges: [createEdge(`${id}-start`, `${id}-return`)],
  };
}

function createOutputNode(id: string, expression: string): FlowEditorNode {
  return createNode(id, "output", `Mostrar ${expression}`, {
    expression,
    outputMode: "expression",
  });
}

function assertHasIssue(
  issues: ReturnType<typeof validateFlowDiagram>,
  id: string,
  severity: "error" | "warning",
) {
  assertAllIssuesHaveSeverity(issues);
  assert.equal(
    issues.find((issue) => issue.id === id)?.severity,
    severity,
    `${id} should be ${severity}`,
  );
}

function assertAllIssuesHaveSeverity(
  issues: ReturnType<typeof validateFlowDiagram>,
) {
  for (const issue of issues) {
    assert.ok(issue.severity === "error" || issue.severity === "warning");
  }
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
  sourceHandle = "out",
): FlowEditorEdge {
  return {
    id: `${source}-${sourceHandle}-${target}`,
    source,
    sourceHandle,
    target,
    targetHandle: "in",
    type: "flow",
  } as FlowEditorEdge;
}
