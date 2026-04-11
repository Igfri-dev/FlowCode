import { parseExpression } from "@babel/parser";
import type {
  BinaryExpression,
  Expression,
  LogicalExpression,
} from "@babel/types";
import {
  createFlowGraph,
  getOutgoingEdges,
  type FlowConnectionLike,
} from "@/features/flow/flow-graph";
import type { FlowEditorEdge, FlowEditorNode, FlowNodeType } from "@/types/flow";

export type ExecutionValue = number | string | boolean | null | undefined;
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
  const conditionResult = evaluateExpression(condition, variables);

  if (!conditionResult.ok) {
    return conditionResult;
  }

  return {
    ok: true,
    value: Boolean(conditionResult.value),
  };
}

function evaluateExpression(
  expression: string,
  variables: ExecutionVariables,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  try {
    return evaluateExpressionNode(
      parseExpression(expression, {
        sourceType: "unambiguous",
      }),
      variables,
    );
  } catch (error) {
    if (error instanceof Error) {
      return {
        ok: false,
        message: `Expresión no soportada: "${expression}". ${error.message}`,
      };
    }

    return {
      ok: false,
      message: `Expresión no soportada: "${expression}".`,
    };
  }
}

function evaluateExpressionNode(
  expression: Expression,
  variables: ExecutionVariables,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  if (expression.type === "Identifier") {
    if (expression.name in variables) {
      return {
        ok: true,
        value: variables[expression.name],
      };
    }

    return {
      ok: false,
      message: `No se encontró la variable "${expression.name}".`,
    };
  }

  if (expression.type === "NumericLiteral") {
    return { ok: true, value: expression.value };
  }

  if (expression.type === "StringLiteral") {
    return { ok: true, value: expression.value };
  }

  if (expression.type === "BooleanLiteral") {
    return { ok: true, value: expression.value };
  }

  if (expression.type === "NullLiteral") {
    return { ok: true, value: null };
  }

  if (expression.type === "ParenthesizedExpression") {
    return evaluateExpressionNode(expression.expression, variables);
  }

  if (expression.type === "UnaryExpression") {
    return evaluateUnaryExpression(expression, variables);
  }

  if (expression.type === "LogicalExpression") {
    return evaluateLogicalExpression(expression, variables);
  }

  if (expression.type === "BinaryExpression") {
    return evaluateBinaryExpression(expression, variables);
  }

  return {
    ok: false,
    message: `La expresión "${expression.type}" todavía no está soportada.`,
  };
}

function evaluateUnaryExpression(
  expression: Extract<Expression, { type: "UnaryExpression" }>,
  variables: ExecutionVariables,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  const argumentResult = evaluateExpressionNode(expression.argument, variables);

  if (!argumentResult.ok) {
    return argumentResult;
  }

  switch (expression.operator) {
    case "!":
      return { ok: true, value: !argumentResult.value };
    case "+":
      return applyUnaryNumberOperator(argumentResult.value, "+");
    case "-":
      return applyUnaryNumberOperator(argumentResult.value, "-");
    default:
      return {
        ok: false,
        message: `Operador unario no soportado: "${expression.operator}".`,
      };
  }
}

function evaluateLogicalExpression(
  expression: LogicalExpression,
  variables: ExecutionVariables,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  const leftResult = evaluateExpressionNode(expression.left, variables);

  if (!leftResult.ok) {
    return leftResult;
  }

  if (expression.operator === "&&" && !leftResult.value) {
    return {
      ok: true,
      value: leftResult.value,
    };
  }

  if (expression.operator === "||" && leftResult.value) {
    return {
      ok: true,
      value: leftResult.value,
    };
  }

  if (
    expression.operator === "??" &&
    leftResult.value !== null &&
    leftResult.value !== undefined
  ) {
    return {
      ok: true,
      value: leftResult.value,
    };
  }

  return evaluateExpressionNode(expression.right, variables);
}

function evaluateBinaryExpression(
  expression: BinaryExpression,
  variables: ExecutionVariables,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  if (expression.left.type === "PrivateName") {
    return {
      ok: false,
      message: "Los campos privados no están soportados en expresiones.",
    };
  }

  const leftResult = evaluateExpressionNode(expression.left, variables);
  const rightResult = evaluateExpressionNode(expression.right, variables);

  if (!leftResult.ok) {
    return leftResult;
  }

  if (!rightResult.ok) {
    return rightResult;
  }

  if (isArithmeticOperator(expression.operator)) {
    return applyArithmeticOperator(
      leftResult.value,
      expression.operator,
      rightResult.value,
    );
  }

  if (isComparisonOperator(expression.operator)) {
    return applyComparisonOperator(
      leftResult.value,
      expression.operator,
      rightResult.value,
    );
  }

  return {
    ok: false,
    message: `Operador no soportado: "${expression.operator}".`,
  };
}

function applyUnaryNumberOperator(value: ExecutionValue, operator: "+" | "-") {
  if (typeof value !== "number") {
    return {
      ok: false,
      message: `El operador "${operator}" solo soporta números en esta versión.`,
    } as const;
  }

  return {
    ok: true,
    value: operator === "-" ? -value : value,
  } as const;
}

function applyArithmeticOperator(
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
    case "%":
      return { ok: true, value: leftValue % rightValue };
    default:
      return {
        ok: false,
        message: `Operador no soportado: "${operator}".`,
      };
  }
}

function applyComparisonOperator(
  leftValue: ExecutionValue,
  operator: string,
  rightValue: ExecutionValue,
): { ok: true; value: boolean } | { ok: false; message: string } {
  if (isRelationalOperator(operator)) {
    if (!isComparableValue(leftValue) || !isComparableValue(rightValue)) {
      return {
        ok: false,
        message: `El operador "${operator}" necesita números o textos comparables.`,
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

function isArithmeticOperator(operator: string) {
  return (
    operator === "+" ||
    operator === "-" ||
    operator === "*" ||
    operator === "/" ||
    operator === "%"
  );
}

function isComparisonOperator(operator: string) {
  return (
    isRelationalOperator(operator) ||
    operator === "===" ||
    operator === "!==" ||
    operator === "==" ||
    operator === "!="
  );
}

function isRelationalOperator(operator: string) {
  return (
    operator === ">" ||
    operator === "<" ||
    operator === ">=" ||
    operator === "<="
  );
}

function isComparableValue(
  value: ExecutionValue,
): value is number | string {
  return typeof value === "number" || typeof value === "string";
}
