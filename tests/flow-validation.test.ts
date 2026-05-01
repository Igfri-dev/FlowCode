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

    assert.ok(messages.some((message) => message.includes("no tiene conexión de entrada")));
    assert.ok(messages.some((message) => message.includes("no tiene conexión de salida")));
    assert.ok(messages.some((message) => message.includes("no es alcanzable desde Inicio")));
  });

  it("reports missing, duplicated and ambiguous decision branches", () => {
    const issues = validateFlowDiagram({
      nodes: [
        createNode("start", "start", "Inicio", {}),
        createNode("decision", "decision", "x > 0", { condition: "x > 0" }),
        createNode("yes-a", "output", "Mostrar A", {
          expression: '"A"',
          outputMode: "expression",
        }),
        createNode("yes-b", "output", "Mostrar B", {
          expression: '"B"',
          outputMode: "expression",
        }),
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

    assert.ok(messages.some((message) => message.includes("necesita una rama No")));
    assert.ok(messages.some((message) => message.includes("más de una rama Sí")));
    assert.ok(messages.some((message) => message.includes("salida sin rama Sí/No")));
  });

  it("reports invalid function calls, main returns and function definitions", () => {
    const functionWithoutReturn: FlowFunctionDefinition = {
      id: "function-1",
      name: "calcular",
      parameters: ["x", "y"],
      nodes: [
        createNode("fn-process", "process", "let total = x + y", {
          instruction: "let total = x + y",
        }),
        createNode("fn-end", "end", "Fin", {}),
      ],
      edges: [createEdge("fn-process", "fn-end")],
    };
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
      functions: [functionWithoutReturn],
    });
    const messages = issues.map((issue) => issue.message);

    assert.ok(messages.some((message) => message.includes("espera al menos 2 argumento")));
    assert.ok(messages.some((message) => message.includes("solo debe usarse dentro de una funcion")));
    assert.ok(messages.some((message) => message.includes("necesita un bloque Inicio")));
    assert.ok(messages.some((message) => message.startsWith("Aviso:")));
  });
});

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
