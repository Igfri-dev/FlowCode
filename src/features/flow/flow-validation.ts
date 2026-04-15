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
  FlowFunctionParameterDefinition,
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
    ...validateControlFlowMetadata(graph),
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

      const parameterDefinitions = getFunctionParameterDefinitions(flowFunction);
      const argumentCountValidation = validateFunctionArgumentCount(
        flowFunction.name,
        parameterDefinitions,
        config.args.length,
      );

      if (!argumentCountValidation.ok) {
        issues.push({
          id: `${node.id}-function-call-args`,
          message: argumentCountValidation.message,
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

function validateControlFlowMetadata(graph: FlowGraph): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];

  for (const node of graph.nodes) {
    if (node.type === "process" && "instruction" in node.data.config) {
      const instruction = node.data.config.instruction.trim().replace(/;$/, "");
      const controlFlow = node.data.config.controlFlow;

      if (
        (instruction === "break" || instruction === "continue") &&
        controlFlow?.kind !== instruction
      ) {
        issues.push({
          id: `${node.id}-${instruction}-context`,
          message: `El bloque "${instruction}" debe venir de un ciclo o switch valido para conectarse correctamente.`,
        });
      }

      if (
        controlFlow?.kind === "forInit" &&
        !graph.nodeById.has(controlFlow.loopDecisionId)
      ) {
        issues.push({
          id: `${node.id}-for-init-target`,
          message: `El inicializador for "${getNodeName(node)}" apunta a un ciclo que no existe.`,
        });
      }

      if (
        controlFlow?.kind === "forUpdate" &&
        !graph.nodeById.has(controlFlow.loopDecisionId)
      ) {
        issues.push({
          id: `${node.id}-for-update-target`,
          message: `La actualizacion for "${getNodeName(node)}" apunta a un ciclo que no existe.`,
        });
      }
    }

    if (node.type !== "decision" || !("condition" in node.data.config)) {
      continue;
    }

    const controlFlow = node.data.config.controlFlow;

    if (!controlFlow) {
      continue;
    }

    if (controlFlow.kind === "for") {
      if (!node.data.config.condition.trim()) {
        issues.push({
          id: `${node.id}-for-condition`,
          message: `El ciclo for "${getNodeName(node)}" necesita una condicion interna valida.`,
        });
      }

      if (
        controlFlow.updateNodeId &&
        !graph.nodeById.has(controlFlow.updateNodeId)
      ) {
        issues.push({
          id: `${node.id}-for-update`,
          message: `El ciclo for "${getNodeName(node)}" referencia una actualizacion que no existe.`,
        });
      }
    }

    if (controlFlow.kind === "switch") {
      if (!controlFlow.discriminant.trim()) {
        issues.push({
          id: `${node.id}-switch-discriminant`,
          message: `El switch "${getNodeName(node)}" necesita una expresion a evaluar.`,
        });
      }

      if (controlFlow.cases.length === 0) {
        issues.push({
          id: `${node.id}-switch-cases`,
          message: `El switch "${getNodeName(node)}" debe tener al menos un case o default.`,
        });
      }

      for (const caseDecisionId of controlFlow.caseDecisionIds) {
        if (!graph.nodeById.has(caseDecisionId)) {
          issues.push({
            id: `${node.id}-switch-case-${caseDecisionId}`,
            message: `El switch "${getNodeName(node)}" referencia un case que no existe.`,
          });
        }
      }
    }

    if (
      controlFlow.kind === "switchCase" &&
      !graph.nodeById.has(controlFlow.switchRootId)
    ) {
      issues.push({
        id: `${node.id}-switch-root`,
        message: `El case "${getNodeName(node)}" apunta a un switch que no existe.`,
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

function getFunctionParameterDefinitions(
  flowFunction: FlowFunctionDefinition,
): FlowFunctionParameterDefinition[] {
  return flowFunction.parameterDefinitions?.length
    ? flowFunction.parameterDefinitions
    : flowFunction.parameters.map(parameterTextToDefinition);
}

function parameterTextToDefinition(
  parameter: string,
): FlowFunctionParameterDefinition {
  const trimmedParameter = parameter.trim();

  if (trimmedParameter.startsWith("...")) {
    return {
      name: trimmedParameter.slice(3).trim(),
      source: trimmedParameter,
      rest: true,
    };
  }

  const defaultSeparatorIndex = trimmedParameter.indexOf("=");

  if (defaultSeparatorIndex >= 0) {
    return {
      name: trimmedParameter.slice(0, defaultSeparatorIndex).trim(),
      source: trimmedParameter,
      defaultValue: trimmedParameter.slice(defaultSeparatorIndex + 1).trim(),
    };
  }

  return {
    name: trimmedParameter,
    source: trimmedParameter,
  };
}

function validateFunctionArgumentCount(
  functionName: string,
  parameters: FlowFunctionParameterDefinition[],
  argumentCount: number,
): { ok: true } | { ok: false; message: string } {
  const restParameter = parameters.find((parameter) => parameter.rest);
  const normalParameters = parameters.filter((parameter) => !parameter.rest);
  const requiredCount = normalParameters.filter(
    (parameter) => parameter.defaultValue === undefined,
  ).length;

  if (argumentCount < requiredCount) {
    return {
      ok: false,
      message: `La funcion "${functionName}" espera al menos ${requiredCount} argumento(s), pero la llamada tiene ${argumentCount}.`,
    };
  }

  if (!restParameter && argumentCount > normalParameters.length) {
    return {
      ok: false,
      message: `La funcion "${functionName}" espera como maximo ${normalParameters.length} argumento(s), pero la llamada tiene ${argumentCount}.`,
    };
  }

  return {
    ok: true,
  };
}

function getNodeName(node: FlowEditorNode) {
  const label = node.data.label.trim();

  return label || `${nodeTypeNames[node.type]} ${node.id}`;
}
