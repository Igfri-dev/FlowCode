import {
  createFlowGraph,
  getOutgoingEdges,
  type FlowConnectionLike,
} from "@/features/flow/flow-graph";
import type { FlowEditorEdge, FlowEditorNode, FlowNodeType } from "@/types/flow";

export type ExecutionValue = number | string | boolean | undefined;
export type ExecutionVariables = Record<string, ExecutionValue>;

export type FlowExecutionHistoryItem = {
  id: string;
  step: number;
  nodeId: string;
  nodeType: FlowNodeType;
  content: string;
  message: string;
  variables: ExecutionVariables;
  edgeId?: string;
  branchLabel?: "Sí" | "No";
};

export type FlowExecutionState = {
  currentNodeId: string | null;
  variables: ExecutionVariables;
  history: FlowExecutionHistoryItem[];
  status: "idle" | "running" | "finished" | "error";
  message: string;
  stepCount: number;
  maxSteps: number;
  activeEdgeId: string | null;
  activeDecision: {
    nodeId: string;
    branch: "yes" | "no";
    branchLabel: "Sí" | "No";
    edgeId?: string;
  } | null;
};

export const initialFlowExecutionState: FlowExecutionState = {
  currentNodeId: null,
  variables: {},
  history: [],
  status: "idle",
  message: "Listo para ejecutar.",
  stepCount: 0,
  maxSteps: 100,
  activeEdgeId: null,
  activeDecision: null,
};

type StepFlowExecutionInput = {
  nodes: FlowEditorNode[];
  edges: FlowEditorEdge[];
  state: FlowExecutionState;
};

export function resetFlowExecution(): FlowExecutionState {
  return initialFlowExecutionState;
}

export function stepFlowExecution({
  nodes,
  edges,
  state,
}: StepFlowExecutionInput): FlowExecutionState {
  if (state.status === "finished" || state.status === "error") {
    return state;
  }

  if (state.stepCount >= state.maxSteps) {
    return {
      ...state,
      status: "error",
      message: `Se alcanzó el límite de ${state.maxSteps} pasos. Revisa si hay un bucle infinito.`,
    };
  }

  const graph = createFlowGraph(nodes, edges);
  const currentNode = state.currentNodeId
    ? graph.nodeById.get(state.currentNodeId)
    : nodes.find((node) => node.type === "start");

  if (!currentNode) {
    return {
      ...state,
      status: "error",
      message: state.currentNodeId
        ? "El bloque actual ya no existe en el diagrama."
        : "No se encontró un bloque Inicio.",
    };
  }

  if (currentNode.type === "end") {
    return recordStep({
      state,
      node: currentNode,
      variables: state.variables,
      message: "Ejecución finalizada.",
      status: "finished",
    });
  }

  if (currentNode.type === "process") {
    const instruction =
      "instruction" in currentNode.data.config
        ? currentNode.data.config.instruction
        : "";
    const instructionResult = executeInstruction(
      instruction,
      state.variables,
    );

    if (!instructionResult.ok) {
      return {
        ...state,
        status: "error",
        message: instructionResult.message,
      };
    }

    const nextEdge = getSingleNextEdge(graph.edges, currentNode.id);

    if (!nextEdge) {
      return {
        ...state,
        status: "error",
        message: `El bloque "${currentNode.data.label}" no tiene salida para continuar.`,
      };
    }

    const nextNode = graph.nodeById.get(nextEdge.target);

    return recordStep({
      state,
      node: currentNode,
      variables: instructionResult.variables,
      message:
        nextNode?.type === "end"
          ? "Ejecución finalizada."
          : `Proceso ejecutado: ${instruction}`,
      nextNodeId: nextEdge.target,
      edgeId: nextEdge.id,
      status: nextNode?.type === "end" ? "finished" : "running",
    });
  }

  if (currentNode.type === "decision") {
    const condition =
      "condition" in currentNode.data.config
        ? currentNode.data.config.condition
        : "";
    const conditionResult = evaluateCondition(condition, state.variables);

    if (!conditionResult.ok) {
      return {
        ...state,
        status: "error",
        message: conditionResult.message,
      };
    }

    const branch = conditionResult.value ? "yes" : "no";
    const branchLabel = conditionResult.value ? "Sí" : "No";
    const nextEdge = getOutgoingEdges(graph, currentNode.id).find(
      (edge) => edge.sourceHandle === branch,
    );

    if (!nextEdge) {
      return {
        ...state,
        status: "error",
        message: `La condición fue ${conditionResult.value ? "verdadera" : "falsa"}, pero no existe la rama ${branchLabel}.`,
      };
    }

    const nextNode = graph.nodeById.get(nextEdge.target);

    return recordStep({
      state,
      node: currentNode,
      variables: state.variables,
      message:
        nextNode?.type === "end"
          ? "Ejecución finalizada."
          : `Condición "${condition}" = ${branchLabel}.`,
      nextNodeId: nextEdge.target,
      edgeId: nextEdge.id,
      branchLabel,
      activeDecision: {
        nodeId: currentNode.id,
        branch,
        branchLabel,
        edgeId: nextEdge.id,
      },
      status: nextNode?.type === "end" ? "finished" : "running",
    });
  }

  const nextEdge = getSingleNextEdge(graph.edges, currentNode.id);

  if (!nextEdge) {
    return {
      ...state,
      status: "error",
      message: `El bloque "${currentNode.data.label}" no tiene salida para continuar.`,
    };
  }

  const nextNode = graph.nodeById.get(nextEdge.target);

  return recordStep({
    state,
    node: currentNode,
    variables: state.variables,
    message:
      nextNode?.type === "end"
        ? "Ejecución finalizada."
        : `Avanzando desde "${currentNode.data.label}".`,
    nextNodeId: nextEdge.target,
    edgeId: nextEdge.id,
    status: nextNode?.type === "end" ? "finished" : "running",
  });
}

function recordStep({
  state,
  node,
  variables,
  message,
  nextNodeId = node.id,
  edgeId,
  branchLabel,
  activeDecision = null,
  status = "running",
}: {
  state: FlowExecutionState;
  node: FlowEditorNode;
  variables: ExecutionVariables;
  message: string;
  nextNodeId?: string;
  edgeId?: string;
  branchLabel?: "Sí" | "No";
  activeDecision?: FlowExecutionState["activeDecision"];
  status?: FlowExecutionState["status"];
}): FlowExecutionState {
  const nextStep = state.stepCount + 1;
  const historyItem: FlowExecutionHistoryItem = {
    id: `${nextStep}-${node.id}`,
    step: nextStep,
    nodeId: node.id,
    nodeType: node.type,
    content: getNodeExecutionContent(node),
    message,
    variables,
    edgeId,
    branchLabel,
  };

  return {
    ...state,
    currentNodeId: nextNodeId,
    variables,
    history: [...state.history, historyItem],
    status,
    message,
    stepCount: nextStep,
    activeEdgeId: edgeId ?? null,
    activeDecision,
  };
}

function getNodeExecutionContent(node: FlowEditorNode) {
  if (node.type === "process" && "instruction" in node.data.config) {
    return node.data.config.instruction;
  }

  if (node.type === "decision" && "condition" in node.data.config) {
    return node.data.config.condition;
  }

  return node.data.label;
}

function getSingleNextEdge(edges: FlowConnectionLike[], nodeId: string) {
  return edges.find((edge) => edge.source === nodeId);
}

function executeInstruction(
  instruction: string,
  variables: ExecutionVariables,
):
  | { ok: true; variables: ExecutionVariables }
  | { ok: false; message: string } {
  const trimmedInstruction = instruction.trim();
  const assignmentMatch = trimmedInstruction.match(
    /^(?:(let|const|var)\s+)?([A-Za-z_$][\w$]*)(?:\s*=\s*(.+))?$/,
  );

  if (!assignmentMatch || (!assignmentMatch[1] && !assignmentMatch[3])) {
    return {
      ok: false,
      message: `Instrucción no soportada: "${instruction}". Usa asignaciones o declaraciones como x = 5, let x = 5 o x = x + 1.`,
    };
  }

  const [, , variableName, expression] = assignmentMatch;

  if (!expression) {
    return {
      ok: true,
      variables: {
        ...variables,
        [variableName]: undefined,
      },
    };
  }

  const expressionResult = evaluateExpression(expression, variables);

  if (!expressionResult.ok) {
    return expressionResult;
  }

  return {
    ok: true,
    variables: {
      ...variables,
      [variableName]: expressionResult.value,
    },
  };
}

function evaluateCondition(
  condition: string,
  variables: ExecutionVariables,
): { ok: true; value: boolean } | { ok: false; message: string } {
  const conditionMatch = condition
    .trim()
    .match(/^(.+?)\s*(===|!==|>=|<=|>|<|==|!=)\s*(.+)$/);

  if (!conditionMatch) {
    return {
      ok: false,
      message: `Condición no soportada: "${condition}". Usa comparaciones como x > 5 o x === 0.`,
    };
  }

  const [, leftExpression, operator, rightExpression] = conditionMatch;
  const leftResult = evaluateExpression(leftExpression, variables);
  const rightResult = evaluateExpression(rightExpression, variables);

  if (!leftResult.ok) {
    return leftResult;
  }

  if (!rightResult.ok) {
    return rightResult;
  }

  const leftValue = leftResult.value;
  const rightValue = rightResult.value;

  if (isRelationalOperator(operator)) {
    if (leftValue === undefined || rightValue === undefined) {
      return {
        ok: false,
        message: `No se puede comparar "${condition}" porque una variable no tiene valor asignado.`,
      };
    }

    switch (operator) {
      case ">":
        return { ok: true, value: leftValue > rightValue };
      case "<":
        return { ok: true, value: leftValue < rightValue };
      case ">=":
        return { ok: true, value: leftValue >= rightValue };
      case "<=":
        return { ok: true, value: leftValue <= rightValue };
    }
  }

  switch (operator) {
    case "===":
      return { ok: true, value: leftValue === rightValue };
    case "!==":
      return { ok: true, value: leftValue !== rightValue };
    case "==":
      return { ok: true, value: leftValue == rightValue };
    case "!=":
      return { ok: true, value: leftValue != rightValue };
    default:
      return {
        ok: false,
        message: `Operador no soportado: "${operator}".`,
      };
  }
}

function evaluateExpression(
  expression: string,
  variables: ExecutionVariables,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  const trimmedExpression = expression.trim();
  const binaryMatch = trimmedExpression.match(/^(.+?)\s*([+\-*/])\s*(.+)$/);

  if (binaryMatch) {
    const [, leftExpression, operator, rightExpression] = binaryMatch;
    const leftResult = evaluateValue(leftExpression, variables);
    const rightResult = evaluateValue(rightExpression, variables);

    if (!leftResult.ok) {
      return leftResult;
    }

    if (!rightResult.ok) {
      return rightResult;
    }

    return applyBinaryOperator(leftResult.value, operator, rightResult.value);
  }

  return evaluateValue(trimmedExpression, variables);
}

function isRelationalOperator(operator: string) {
  return (
    operator === ">" ||
    operator === "<" ||
    operator === ">=" ||
    operator === "<="
  );
}

function evaluateValue(
  value: string,
  variables: ExecutionVariables,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  const trimmedValue = value.trim();

  if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) {
    return { ok: true, value: Number(trimmedValue) };
  }

  if (trimmedValue === "true" || trimmedValue === "false") {
    return { ok: true, value: trimmedValue === "true" };
  }

  const quotedStringMatch = trimmedValue.match(/^["'](.*)["']$/);

  if (quotedStringMatch) {
    return { ok: true, value: quotedStringMatch[1] };
  }

  if (trimmedValue in variables) {
    return { ok: true, value: variables[trimmedValue] };
  }

  return {
    ok: false,
    message: `No se encontró la variable o valor "${trimmedValue}".`,
  };
}

function applyBinaryOperator(
  leftValue: ExecutionValue,
  operator: string,
  rightValue: ExecutionValue,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  if (
    operator === "+" &&
    (typeof leftValue === "string" || typeof rightValue === "string")
  ) {
    return { ok: true, value: `${leftValue}${rightValue}` };
  }

  if (typeof leftValue !== "number" || typeof rightValue !== "number") {
    return {
      ok: false,
      message: `El operador "${operator}" solo soporta números en esta versión.`,
    };
  }

  switch (operator) {
    case "+":
      return { ok: true, value: leftValue + rightValue };
    case "-":
      return { ok: true, value: leftValue - rightValue };
    case "*":
      return { ok: true, value: leftValue * rightValue };
    case "/":
      return { ok: true, value: leftValue / rightValue };
    default:
      return {
        ok: false,
        message: `Operador no soportado: "${operator}".`,
      };
  }
}
