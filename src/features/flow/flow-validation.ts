import {
  createFlowGraph,
  getIncomingEdges,
  getOutgoingEdges,
  type FlowConnectionLike,
  type FlowGraph,
} from "@/features/flow/flow-graph";
import type {
  FlowEditorNode,
  FlowFunctionDefinition,
  FlowNodeType,
} from "@/types/flow";

export type { FlowConnectionLike } from "@/features/flow/flow-graph";

export type FlowValidationIssue = {
  id: string;
  message: string;
};

type FlowValidationInput = {
  nodes: FlowEditorNode[];
  edges: FlowConnectionLike[];
  functions?: FlowFunctionDefinition[];
  currentDiagramId?: string;
};

type FlowConnectionValidationInput = FlowValidationInput & {
  connection: FlowConnectionLike;
};

const nodeTypeNames: Record<FlowNodeType, string> = {
  start: "Inicio",
  end: "Fin",
  process: "Proceso",
  decision: "Decision",
  input: "Entrada",
  output: "Salida",
  functionCall: "Llamada",
  return: "Retorno",
};

export function validateFlowDiagram({
  nodes,
  edges,
  functions = [],
  currentDiagramId = "main",
}: FlowValidationInput): FlowValidationIssue[] {
  const graph = createFlowGraph(nodes, edges);

  return [
    ...validateStartCount(graph),
    ...validateInvalidEdges(graph),
    ...validateNodeConnectionLimits(graph),
    ...validateNodeConfigs(graph.nodes, functions, currentDiagramId),
    ...validateFunctionDefinitions(functions),
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

    if ((node.type === "end" || node.type === "return") && outgoing > 0) {
      issues.push({
        id: `${node.id}-terminal-outgoing`,
        message: `El bloque ${nodeTypeNames[node.type]} "${nodeName}" no debe tener conexiones de salida.`,
      });
    }
  }

  return issues;
}

function validateNodeConfigs(
  nodes: FlowEditorNode[],
  functions: FlowFunctionDefinition[],
  currentDiagramId: string,
): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  const functionById = new Map(functions.map((flowFunction) => [flowFunction.id, flowFunction]));

  for (const node of nodes) {
    const nodeName = getNodeName(node);

    if (node.type === "input") {
      const variableName =
        "variableName" in node.data.config ? node.data.config.variableName.trim() : "";

      if (!variableName) {
        issues.push({
          id: `${node.id}-input-variable`,
          message: `El bloque Entrada "${nodeName}" necesita una variable para guardar el valor.`,
        });
      }
    }

    if (node.type === "functionCall") {
      const config = node.data.config;

      if (!("functionId" in config) || !config.functionId) {
        issues.push({
          id: `${node.id}-function-call-missing`,
          message: `La llamada "${nodeName}" debe seleccionar una funcion.`,
        });
        continue;
      }

      const flowFunction = functionById.get(config.functionId);

      if (!flowFunction) {
        issues.push({
          id: `${node.id}-function-call-invalid`,
          message: `La llamada "${nodeName}" referencia una funcion que no existe.`,
        });
        continue;
      }

      if (config.args.length !== flowFunction.parameters.length) {
        issues.push({
          id: `${node.id}-function-call-args`,
          message: `La funcion "${flowFunction.name}" espera ${flowFunction.parameters.length} argumento(s), pero la llamada tiene ${config.args.length}.`,
        });
      }
    }

    if (node.type === "return" && currentDiagramId === "main") {
      issues.push({
        id: `${node.id}-return-in-main`,
        message: `El bloque Retorno "${nodeName}" solo debe usarse dentro de una funcion.`,
      });
    }
  }

  return issues;
}

function validateFunctionDefinitions(
  functions: FlowFunctionDefinition[],
): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  const names = new Map<string, number>();

  for (const flowFunction of functions) {
    const name = flowFunction.name.trim();

    if (!name) {
      issues.push({
        id: `${flowFunction.id}-function-name`,
        message: "Todas las funciones deben tener nombre.",
      });
      continue;
    }

    names.set(name, (names.get(name) ?? 0) + 1);
  }

  for (const [name, count] of names) {
    if (count > 1) {
      issues.push({
        id: `function-name-${name}`,
        message: `El nombre de funcion "${name}" esta repetido.`,
      });
    }
  }

  return issues;
}

function getNodeName(node: FlowEditorNode) {
  const label = node.data.label.trim();

  return label || `${nodeTypeNames[node.type]} ${node.id}`;
}
