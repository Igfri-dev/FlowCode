import {
  createFlowGraph,
  getIncomingEdges,
  getOutgoingEdges,
  getOutgoingEdgesByHandle,
  type FlowConnectionLike,
  type FlowGraph,
} from "@/features/flow/flow-graph";
import {
  validateExpressionSupport,
  validateProcessInstructionSupport,
} from "@/features/flow/execution";
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
  severity: "error" | "warning";
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
  return dedupeIssuesById([
    ...validateSingleDiagram({
      currentDiagramId,
      edges,
      functions,
      nodes,
    }),
    ...validateFunctionDefinitions(functions),
    ...functions.flatMap((flowFunction) =>
      validateSingleDiagram({
        currentDiagramId: flowFunction.id,
        edges: flowFunction.edges,
        functions,
        idPrefix: `${flowFunction.id}-`,
        messagePrefix: `En la función "${getFunctionDisplayName(flowFunction)}": `,
        nodes: flowFunction.nodes,
      }),
    ),
  ]);
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
    ...validateNodeConnectionLimits(graph, affectedNodeIds, {
      requireCompleteness: false,
    }),
  ];
}

function validateSingleDiagram({
  currentDiagramId,
  edges,
  functions = [],
  idPrefix = "",
  messagePrefix = "",
  nodes,
}: FlowValidationInput & {
  idPrefix?: string;
  messagePrefix?: string;
}): FlowValidationIssue[] {
  const graph = createFlowGraph(nodes, edges);
  const issues = [
    ...validateStartCount(graph),
    ...validateInvalidEdges(graph),
    ...validateNodeConnectionLimits(graph),
    ...validateReachability(graph),
    ...validateNodeConfigs(graph.nodes, functions, currentDiagramId ?? "main"),
    ...validateControlFlowMetadata(graph),
  ];

  return messagePrefix || idPrefix
    ? issues.map((issue) =>
        scopeIssue(issue, {
          idPrefix,
          messagePrefix,
        }),
      )
    : issues;
}

function errorIssue(id: string, message: string): FlowValidationIssue {
  return {
    id,
    message,
    severity: "error",
  };
}

function warningIssue(id: string, message: string): FlowValidationIssue {
  return {
    id,
    message,
    severity: "warning",
  };
}

function scopeIssue(
  issue: FlowValidationIssue,
  {
    idPrefix,
    messagePrefix,
  }: {
    idPrefix: string;
    messagePrefix: string;
  },
): FlowValidationIssue {
  return {
    ...issue,
    id: `${idPrefix}${issue.id}`,
    message: messagePrefix
      ? `${messagePrefix}${lowercaseFirstLetter(issue.message)}`
      : issue.message,
  };
}

function lowercaseFirstLetter(message: string) {
  return message.length === 0
    ? message
    : `${message.charAt(0).toLocaleLowerCase("es")}${message.slice(1)}`;
}

function dedupeIssuesById(issues: FlowValidationIssue[]) {
  const issueById = new Map<string, FlowValidationIssue>();

  for (const issue of issues) {
    if (!issueById.has(issue.id)) {
      issueById.set(issue.id, issue);
    }
  }

  return Array.from(issueById.values());
}

function validateStartCount(graph: FlowGraph): FlowValidationIssue[] {
  const startCount = graph.nodes.filter((node) => node.type === "start").length;

  if (startCount === 1) {
    return [];
  }

  return [
    errorIssue(
      "start-count",
      startCount === 0
        ? "Debe existir exactamente un bloque Inicio."
        : `Debe existir exactamente un bloque Inicio; hay ${startCount}.`,
    ),
  ];
}

function validateInvalidEdges(graph: FlowGraph): FlowValidationIssue[] {
  return graph.edges.flatMap((edge, index) => {
    const edgeId = edge.id ?? `connection-${index}`;
    const issues: FlowValidationIssue[] = [];

    if (!graph.nodeById.has(edge.source)) {
      issues.push(
        errorIssue(
          `edge-${edgeId}-source`,
          "Una conexión apunta a un bloque de origen que no existe.",
        ),
      );
    }

    if (!graph.nodeById.has(edge.target)) {
      issues.push(
        errorIssue(
          `edge-${edgeId}-target`,
          "Una conexión apunta a un bloque de destino que no existe.",
        ),
      );
    }

    return issues;
  });
}

function validateNodeConnectionLimits(
  graph: FlowGraph,
  nodeIds?: Set<string>,
  {
    requireCompleteness = true,
  }: {
    requireCompleteness?: boolean;
  } = {},
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
        issues.push(
          errorIssue(
            `${node.id}-start-incoming`,
            `El bloque Inicio "${nodeName}" no debe tener conexiones de entrada.`,
          ),
        );
      }

      if (outgoing > 1) {
        issues.push(
          errorIssue(
            `${node.id}-start-outgoing`,
            `El bloque Inicio "${nodeName}" puede tener como máximo una conexión de salida.`,
          ),
        );
      }

      if (requireCompleteness && outgoing === 0) {
        issues.push(
          errorIssue(
            `${node.id}-start-missing-outgoing`,
            `El bloque Inicio "${nodeName}" debe conectar con el primer bloque del flujo.`,
          ),
        );
      }
    } else if (requireCompleteness && incoming === 0) {
      issues.push(
        errorIssue(
          `${node.id}-missing-incoming`,
          `El bloque ${nodeTypeNames[node.type]} "${nodeName}" no tiene conexión de entrada. Conéctalo desde Inicio o elimínalo si no pertenece al flujo.`,
        ),
      );
    }

    if (node.type === "decision") {
      const yesEdges = getOutgoingEdgesByHandle(graph, node.id, "yes");
      const noEdges = getOutgoingEdgesByHandle(graph, node.id, "no");
      const ambiguousEdges = getOutgoingEdges(graph, node.id).filter(
        (edge) => edge.sourceHandle !== "yes" && edge.sourceHandle !== "no",
      );

      if (outgoing > 2) {
        issues.push(
          errorIssue(
            `${node.id}-decision-outgoing`,
            `El bloque Decisión "${nodeName}" puede tener como máximo dos conexiones de salida.`,
          ),
        );
      }

      if (requireCompleteness && yesEdges.length === 0) {
        issues.push(
          errorIssue(
            `${node.id}-decision-missing-yes`,
            `El bloque Decisión "${nodeName}" necesita una rama Sí conectada.`,
          ),
        );
      }

      if (requireCompleteness && noEdges.length === 0) {
        issues.push(
          errorIssue(
            `${node.id}-decision-missing-no`,
            `El bloque Decisión "${nodeName}" necesita una rama No conectada.`,
          ),
        );
      }

      if (yesEdges.length > 1) {
        issues.push(
          errorIssue(
            `${node.id}-decision-duplicate-yes`,
            `El bloque Decisión "${nodeName}" tiene más de una rama Sí. Deja una sola salida Sí para evitar ambigüedad.`,
          ),
        );
      }

      if (noEdges.length > 1) {
        issues.push(
          errorIssue(
            `${node.id}-decision-duplicate-no`,
            `El bloque Decisión "${nodeName}" tiene más de una rama No. Deja una sola salida No para evitar ambigüedad.`,
          ),
        );
      }

      if (ambiguousEdges.length > 0) {
        issues.push(
          errorIssue(
            `${node.id}-decision-ambiguous-branch`,
            `El bloque Decisión "${nodeName}" tiene una salida sin rama Sí/No. Conecta desde el handle correcto.`,
          ),
        );
      }

      if (branchesShareTargets(yesEdges, noEdges)) {
        issues.push(
          warningIssue(
            `${node.id}-decision-shared-target`,
            `El bloque Decisión "${nodeName}" envía Sí y No al mismo bloque. Separa las ramas antes de unirlas para que el flujo sea claro.`,
          ),
        );
      }
    }

    if (
      node.type !== "start" &&
      node.type !== "decision" &&
      node.type !== "end" &&
      node.type !== "return" &&
      outgoing > 1
    ) {
      issues.push(
        errorIssue(
          `${node.id}-non-decision-multiple-outgoing`,
          `El bloque ${nodeTypeNames[node.type]} "${nodeName}" tiene más de una salida. Solo las decisiones pueden dividir el flujo en ramas.`,
        ),
      );
    }

    if (
      requireCompleteness &&
      node.type !== "decision" &&
      node.type !== "end" &&
      node.type !== "return" &&
      outgoing === 0
    ) {
      issues.push(
        errorIssue(
          `${node.id}-missing-outgoing`,
          `El bloque ${nodeTypeNames[node.type]} "${nodeName}" no tiene conexión de salida. Conéctalo con el siguiente bloque o usa Fin/Retorno si termina el flujo.`,
        ),
      );
    }

    if ((node.type === "end" || node.type === "return") && outgoing > 0) {
      issues.push(
        errorIssue(
          `${node.id}-terminal-outgoing`,
          `El bloque ${nodeTypeNames[node.type]} "${nodeName}" no debe tener conexiones de salida.`,
        ),
      );
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

    if (node.type === "process" && "instruction" in node.data.config) {
      const instructionValidation = validateProcessInstructionSupport(
        node.data.config.instruction,
      );

      if (!instructionValidation.ok) {
        issues.push(
          errorIssue(
            `${node.id}-process-instruction`,
            `El bloque Proceso "${nodeName}" tiene una instruccion no valida: ${instructionValidation.message}`,
          ),
        );
      }
    }

    if (node.type === "decision" && "condition" in node.data.config) {
      const conditionValidation = validateExpressionSupport(
        node.data.config.condition,
      );

      if (!conditionValidation.ok) {
        issues.push(
          errorIssue(
            `${node.id}-decision-condition`,
            `La condicion "${nodeName}" no es valida: ${conditionValidation.message}`,
          ),
        );
      }
    }

    if (node.type === "input") {
      const variableName =
        "variableName" in node.data.config ? node.data.config.variableName.trim() : "";

      if (!variableName) {
        issues.push(
          errorIssue(
            `${node.id}-input-variable`,
            `El bloque Entrada "${nodeName}" necesita una variable para guardar el valor.`,
          ),
        );
      }
    }

    if (node.type === "functionCall") {
      const config = node.data.config;

      if (!("functionId" in config) || !config.functionId) {
        issues.push(
          errorIssue(
            `${node.id}-function-call-missing`,
            `La llamada "${nodeName}" debe seleccionar una funcion.`,
          ),
        );
        continue;
      }

      const flowFunction = functionById.get(config.functionId);

      if (!flowFunction) {
        issues.push(
          errorIssue(
            `${node.id}-function-call-invalid`,
            `La llamada "${nodeName}" referencia una funcion que no existe.`,
          ),
        );
        continue;
      }

      const parameterDefinitions = getFunctionParameterDefinitions(flowFunction);
      const args = Array.isArray(config.args) ? config.args : [];
      const argumentCountValidation = validateFunctionArgumentCount(
        flowFunction.name,
        parameterDefinitions,
        args.length,
      );

      if (!argumentCountValidation.ok) {
        issues.push(
          errorIssue(`${node.id}-function-call-args`, argumentCountValidation.message),
        );
      }

      args.forEach((argument, index) => {
        const argumentValidation = validateExpressionSupport(argument);

        if (!argumentValidation.ok) {
          issues.push(
            errorIssue(
              `${node.id}-function-call-arg-${index}`,
              `El argumento ${index + 1} de "${nodeName}" no es valido: ${argumentValidation.message}`,
            ),
          );
        }
      });

      if (config.assignTo?.trim() && !functionHasClearReturnPath(flowFunction)) {
        issues.push(
          warningIssue(
            `${node.id}-function-call-return-warning`,
            `La llamada "${nodeName}" guarda el resultado de "${flowFunction.name}", pero esa función no tiene un camino claro hacia Retorno. Agrega un Retorno alcanzable para evitar valores indefinidos.`,
          ),
        );
      }
    }

    if (
      node.type === "output" &&
      "outputMode" in node.data.config &&
      node.data.config.outputMode === "expression"
    ) {
      const outputValidation = validateExpressionSupport(
        node.data.config.expression,
      );

      if (!outputValidation.ok) {
        issues.push(
          errorIssue(
            `${node.id}-output-expression`,
            `La salida "${nodeName}" tiene una expresion no valida: ${outputValidation.message}`,
          ),
        );
      }
    }

    if (node.type === "return" && currentDiagramId === "main") {
      issues.push(
        errorIssue(
          `${node.id}-return-in-main`,
          `El bloque Retorno "${nodeName}" solo debe usarse dentro de una funcion.`,
        ),
      );
    }

    if (
      node.type === "return" &&
      "expression" in node.data.config &&
      node.data.config.expression.trim()
    ) {
      const returnValidation = validateExpressionSupport(
        node.data.config.expression.replace(/^return\b\s*/, ""),
      );

      if (!returnValidation.ok) {
        issues.push(
          errorIssue(
            `${node.id}-return-expression`,
            `El retorno "${nodeName}" tiene una expresion no valida: ${returnValidation.message}`,
          ),
        );
      }
    }

  }

  return issues;
}

function validateReachability(graph: FlowGraph): FlowValidationIssue[] {
  const startIds = graph.nodes
    .filter((node) => node.type === "start")
    .map((node) => node.id);

  if (startIds.length === 0) {
    return [];
  }

  const reachableNodeIds = getReachableNodeIds(graph, startIds);

  return graph.nodes
    .filter((node) => !reachableNodeIds.has(node.id))
    .map((node) =>
      errorIssue(
        `${node.id}-unreachable`,
        `El bloque ${nodeTypeNames[node.type]} "${getNodeName(node)}" no es alcanzable desde Inicio. Conéctalo al flujo principal o elimínalo.`,
      ),
    );
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
        issues.push(
          errorIssue(
            `${node.id}-${instruction}-context`,
            `El bloque "${instruction}" debe venir de un ciclo o switch valido para conectarse correctamente.`,
          ),
        );
      }

      if (
        controlFlow?.kind === "forInit" &&
        !graph.nodeById.has(controlFlow.loopDecisionId)
      ) {
        issues.push(
          errorIssue(
            `${node.id}-for-init-target`,
            `El inicializador for "${getNodeName(node)}" apunta a un ciclo que no existe.`,
          ),
        );
      }

      if (
        controlFlow?.kind === "forUpdate" &&
        !graph.nodeById.has(controlFlow.loopDecisionId)
      ) {
        issues.push(
          errorIssue(
            `${node.id}-for-update-target`,
            `La actualizacion for "${getNodeName(node)}" apunta a un ciclo que no existe.`,
          ),
        );
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
        issues.push(
          errorIssue(
            `${node.id}-for-condition`,
            `El ciclo for "${getNodeName(node)}" necesita una condicion interna valida.`,
          ),
        );
      }

      if (
        controlFlow.updateNodeId &&
        !graph.nodeById.has(controlFlow.updateNodeId)
      ) {
        issues.push(
          errorIssue(
            `${node.id}-for-update`,
            `El ciclo for "${getNodeName(node)}" referencia una actualizacion que no existe.`,
          ),
        );
      }
    }

    if (controlFlow.kind === "switch") {
      if (!controlFlow.discriminant.trim()) {
        issues.push(
          errorIssue(
            `${node.id}-switch-discriminant`,
            `El switch "${getNodeName(node)}" necesita una expresion a evaluar.`,
          ),
        );
      }

      if (controlFlow.cases.length === 0) {
        issues.push(
          errorIssue(
            `${node.id}-switch-cases`,
            `El switch "${getNodeName(node)}" debe tener al menos un case o default.`,
          ),
        );
      }

      for (const caseDecisionId of controlFlow.caseDecisionIds) {
        if (!graph.nodeById.has(caseDecisionId)) {
          issues.push(
            errorIssue(
              `${node.id}-switch-case-${caseDecisionId}`,
              `El switch "${getNodeName(node)}" referencia un case que no existe.`,
            ),
          );
        }
      }
    }

    if (
      controlFlow.kind === "switchCase" &&
      !graph.nodeById.has(controlFlow.switchRootId)
    ) {
      issues.push(
        errorIssue(
          `${node.id}-switch-root`,
          `El case "${getNodeName(node)}" apunta a un switch que no existe.`,
        ),
      );
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
      issues.push(
        errorIssue(
          `${flowFunction.id}-function-name`,
          "Todas las funciones deben tener nombre.",
        ),
      );
      continue;
    }

    names.set(name, (names.get(name) ?? 0) + 1);

    getFunctionParameterDefinitions(flowFunction).forEach((parameter) => {
      if (!parameter.defaultValue) {
        return;
      }

      const defaultValidation = validateExpressionSupport(
        parameter.defaultValue,
      );

      if (!defaultValidation.ok) {
        issues.push(
          errorIssue(
            `${flowFunction.id}-parameter-${parameter.name}-default`,
            `El valor por defecto del parametro "${parameter.name}" en "${name}" no es valido: ${defaultValidation.message}`,
          ),
        );
      }
    });
  }

  for (const [name, count] of names) {
    if (count > 1) {
      issues.push(
        errorIssue(
          `function-name-${name}`,
          `El nombre de funcion "${name}" esta repetido.`,
        ),
      );
    }
  }

  return issues;
}

function branchesShareTargets(
  yesEdges: FlowConnectionLike[],
  noEdges: FlowConnectionLike[],
) {
  const yesTargets = new Set(yesEdges.map((edge) => edge.target));

  return noEdges.some((edge) => yesTargets.has(edge.target));
}

function getReachableNodeIds(graph: FlowGraph, startIds: string[]) {
  const reachableNodeIds = new Set<string>();
  const pendingNodeIds = [...startIds];

  while (pendingNodeIds.length > 0) {
    const nodeId = pendingNodeIds.pop();

    if (!nodeId || reachableNodeIds.has(nodeId)) {
      continue;
    }

    reachableNodeIds.add(nodeId);

    for (const edge of getOutgoingEdges(graph, nodeId)) {
      if (graph.nodeById.has(edge.target)) {
        pendingNodeIds.push(edge.target);
      }
    }
  }

  return reachableNodeIds;
}

function functionHasClearReturnPath(flowFunction: FlowFunctionDefinition) {
  const graph = createFlowGraph(flowFunction.nodes, flowFunction.edges);
  const startIds = graph.nodes
    .filter((node) => node.type === "start")
    .map((node) => node.id);

  if (startIds.length === 0) {
    return false;
  }

  const reachableNodeIds = getReachableNodeIds(graph, startIds);
  let hasReachableReturn = false;

  for (const nodeId of reachableNodeIds) {
    const node = graph.nodeById.get(nodeId);

    if (!node) {
      continue;
    }

    if (node.type === "return") {
      hasReachableReturn = true;
      continue;
    }

    if (node.type === "end") {
      return false;
    }

    const validOutgoingEdges = getOutgoingEdges(graph, node.id).filter((edge) =>
      graph.nodeById.has(edge.target),
    );

    if (validOutgoingEdges.length === 0) {
      return false;
    }
  }

  return hasReachableReturn;
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

function getFunctionDisplayName(flowFunction: FlowFunctionDefinition) {
  return flowFunction.name.trim() || "sin nombre";
}
