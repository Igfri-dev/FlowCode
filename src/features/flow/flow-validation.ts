import {
  createFlowGraph,
  getIncomingEdges,
  getOutgoingEdges,
  type FlowConnectionLike,
  type FlowGraph,
} from "@/features/flow/flow-graph";
import type { FlowEditorNode, FlowNodeType } from "@/types/flow";

export type { FlowConnectionLike } from "@/features/flow/flow-graph";

export type FlowValidationIssue = {
  id: string;
  message: string;
};

type FlowValidationInput = {
  nodes: FlowEditorNode[];
  edges: FlowConnectionLike[];
};

type FlowConnectionValidationInput = FlowValidationInput & {
  connection: FlowConnectionLike;
};

const nodeTypeNames: Record<FlowNodeType, string> = {
  start: "Inicio",
  end: "Fin",
  process: "Proceso",
  decision: "Decisión",
};

export function validateFlowDiagram({
  nodes,
  edges,
}: FlowValidationInput): FlowValidationIssue[] {
  const graph = createFlowGraph(nodes, edges);

  return [
    ...validateStartCount(graph),
    ...validateInvalidEdges(graph),
    ...validateNodeConnectionLimits(graph),
  ];
}

export function validateFlowConnection({
  nodes,
  edges,
  connection,
}: FlowConnectionValidationInput): FlowValidationIssue[] {
  const graph = createFlowGraph(nodes, [...edges, connection]);
  const affectedNodeIds = new Set([connection.source, connection.target]);

  return [
    ...validateInvalidEdges(graph),
    ...validateNodeConnectionLimits(graph, affectedNodeIds),
  ];
}

function validateStartCount(graph: FlowGraph): FlowValidationIssue[] {
  const startCount = graph.nodes.filter((node) => node.type === "start").length;

  if (startCount === 1) {
    return [];
  }

  return [
    {
      id: "start-count",
      message:
        startCount === 0
          ? "Debe existir exactamente un bloque Inicio."
          : `Debe existir exactamente un bloque Inicio; hay ${startCount}.`,
    },
  ];
}

function validateInvalidEdges(graph: FlowGraph): FlowValidationIssue[] {
  return graph.edges.flatMap((edge, index) => {
    const edgeId = edge.id ?? `connection-${index}`;
    const issues: FlowValidationIssue[] = [];

    if (!graph.nodeById.has(edge.source)) {
      issues.push({
        id: `edge-${edgeId}-source`,
        message: "Una conexión apunta a un bloque de origen que no existe.",
      });
    }

    if (!graph.nodeById.has(edge.target)) {
      issues.push({
        id: `edge-${edgeId}-target`,
        message: "Una conexión apunta a un bloque de destino que no existe.",
      });
    }

    return issues;
  });
}

function validateNodeConnectionLimits(
  graph: FlowGraph,
  nodeIds?: Set<string>,
): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];

  for (const node of graph.nodes) {
    if (nodeIds && !nodeIds.has(node.id)) {
      continue;
    }

    const incoming = getIncomingEdges(graph, node.id).length;
    const outgoing = getOutgoingEdges(graph, node.id).length;
    const nodeName = getNodeName(node);

    if (node.type === "start") {
      if (incoming > 0) {
        issues.push({
          id: `${node.id}-start-incoming`,
          message: `El bloque Inicio "${nodeName}" no debe tener conexiones de entrada.`,
        });
      }

      if (outgoing > 1) {
        issues.push({
          id: `${node.id}-start-outgoing`,
          message: `El bloque Inicio "${nodeName}" puede tener como máximo una conexión de salida.`,
        });
      }
    }

    if (node.type === "decision") {
      if (outgoing > 2) {
        issues.push({
          id: `${node.id}-decision-outgoing`,
          message: `El bloque Decisión "${nodeName}" puede tener como máximo dos conexiones de salida.`,
        });
      }
    }

    if (node.type === "end" && outgoing > 0) {
      issues.push({
        id: `${node.id}-end-outgoing`,
        message: `El bloque Fin "${nodeName}" no debe tener conexiones de salida.`,
      });
    }
  }

  return issues;
}

function getNodeName(node: FlowEditorNode) {
  const label = node.data.label.trim();

  return label || `${nodeTypeNames[node.type]} ${node.id}`;
}
