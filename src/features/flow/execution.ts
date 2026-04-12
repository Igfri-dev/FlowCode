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
import type {
  FlowEditorDiagram,
  FlowEditorNode,
  FlowProgram,
  FlowNodeType,
  FunctionCallNodeConfig,
  InputNodeConfig,
  OutputNodeConfig,
  ReturnNodeConfig,
} from "@/types/flow";

export type ExecutionValue = number | string | boolean | null | undefined;
export type ExecutionVariables = Record<string, ExecutionValue>;

export type FlowExecutionHistoryItem = {
  id: string;
  step: number;
  nodeId: string;
  nodeType: FlowNodeType;
  diagramName: string;
  content: string;
  message: string;
  variables: ExecutionVariables;
  edgeId?: string;
  branchLabel?: "Si" | "No";
};

export type FlowExecutionOutputItem = {
  id: string;
  step: number;
  content: string;
};

export type FlowExecutionPendingInput = {
  nodeId: string;
  prompt: string;
  variableName: string;
  inputType: InputNodeConfig["inputType"];
  nextNodeId: string;
  edgeId?: string;
};

export type FlowExecutionCallFrame = {
  diagramId: string;
  diagramName: string;
  currentNodeId: string | null;
  variables: ExecutionVariables;
  returnEdgeId?: string;
  assignTo?: string;
};

export type FlowExecutionState = {
  currentNodeId: string | null;
  currentDiagramId: string;
  currentDiagramName: string;
  variables: ExecutionVariables;
  history: FlowExecutionHistoryItem[];
  outputs: FlowExecutionOutputItem[];
  callStack: FlowExecutionCallFrame[];
  pendingInput: FlowExecutionPendingInput | null;
  status: "idle" | "running" | "waitingInput" | "finished" | "error";
  message: string;
  stepCount: number;
  maxSteps: number;
  activeEdgeId: string | null;
  activeDecision: {
    nodeId: string;
    branch: "yes" | "no";
    branchLabel: "Si" | "No";
    edgeId?: string;
  } | null;
};

export const initialFlowExecutionState: FlowExecutionState = {
  currentNodeId: null,
  currentDiagramId: "main",
  currentDiagramName: "Principal",
  variables: {},
  history: [],
  outputs: [],
  callStack: [],
  pendingInput: null,
  status: "idle",
  message: "Listo para ejecutar.",
  stepCount: 0,
  maxSteps: 100,
  activeEdgeId: null,
  activeDecision: null,
};

type StepFlowExecutionInput = {
  program: FlowProgram;
  activeDiagramId: string;
  state: FlowExecutionState;
};

export function resetFlowExecution(
  diagramId = "main",
  diagramName = "Principal",
): FlowExecutionState {
  return {
    ...initialFlowExecutionState,
    currentDiagramId: diagramId,
    currentDiagramName: diagramName,
  };
}

export function stepFlowExecution({
  program,
  activeDiagramId,
  state,
}: StepFlowExecutionInput): FlowExecutionState {
  if (
    state.status === "finished" ||
    state.status === "error" ||
    state.status === "waitingInput"
  ) {
    return state;
  }

  if (state.stepCount >= state.maxSteps) {
    return {
      ...state,
      status: "error",
      message: `Se alcanzo el limite de ${state.maxSteps} pasos. Revisa si hay un bucle infinito.`,
    };
  }

  const diagramId = state.status === "idle" ? activeDiagramId : state.currentDiagramId;
  const diagram = getDiagramById(program, diagramId);

  if (!diagram) {
    return {
      ...state,
      status: "error",
      message: "No se encontro el diagrama actual para ejecutar.",
    };
  }

  const graph = createFlowGraph(diagram.nodes, diagram.edges);
  const currentNode = state.currentNodeId
    ? graph.nodeById.get(state.currentNodeId)
    : diagram.nodes.find((node) => node.type === "start");

  if (!currentNode) {
    return {
      ...state,
      status: "error",
      message: state.currentNodeId
        ? "El bloque actual ya no existe en el diagrama."
        : "No se encontro un bloque Inicio.",
    };
  }

  if (currentNode.type === "start") {
    return advanceToNextNode({
      graphEdges: graph.edges,
      state: ensureExecutionDiagram(state, diagram),
      node: currentNode,
      variables: state.variables,
      message: "Inicio.",
    });
  }

  if (currentNode.type === "end") {
    if (state.callStack.length > 0) {
      return returnToCaller({
        state: ensureExecutionDiagram(state, diagram),
        node: currentNode,
        value: undefined,
      });
    }

    return recordStep({
      state: ensureExecutionDiagram(state, diagram),
      node: currentNode,
      variables: state.variables,
      message: "Ejecucion finalizada.",
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

    return advanceToNextNode({
      graphEdges: graph.edges,
      state: ensureExecutionDiagram(state, diagram),
      node: currentNode,
      variables: instructionResult.variables,
      message: `Proceso ejecutado: ${instruction}`,
    });
  }

  if (currentNode.type === "input") {
    return pauseForInput({
      graphEdges: graph.edges,
      state: ensureExecutionDiagram(state, diagram),
      node: currentNode,
    });
  }

  if (currentNode.type === "output") {
    return executeOutputNode({
      graphEdges: graph.edges,
      state: ensureExecutionDiagram(state, diagram),
      node: currentNode,
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
    const branchLabel = conditionResult.value ? "Si" : "No";
    const nextEdge = getOutgoingEdges(graph, currentNode.id).find(
      (edge) => edge.sourceHandle === branch,
    );

    if (!nextEdge) {
      return {
        ...state,
        status: "error",
        message: `La condicion fue ${conditionResult.value ? "verdadera" : "falsa"}, pero no existe la rama ${branchLabel}.`,
      };
    }

    return recordStep({
      state: ensureExecutionDiagram(state, diagram),
      node: currentNode,
      variables: state.variables,
      message: `Condicion "${condition}" = ${branchLabel}.`,
      nextNodeId: nextEdge.target,
      edgeId: nextEdge.id,
      branchLabel,
      activeDecision: {
        nodeId: currentNode.id,
        branch,
        branchLabel,
        edgeId: nextEdge.id,
      },
    });
  }

  if (currentNode.type === "functionCall") {
    return executeFunctionCallNode({
      graphEdges: graph.edges,
      program,
      state: ensureExecutionDiagram(state, diagram),
      node: currentNode,
    });
  }

  if (currentNode.type === "return") {
    return executeReturnNode({
      state: ensureExecutionDiagram(state, diagram),
      node: currentNode,
    });
  }

  return advanceToNextNode({
    graphEdges: graph.edges,
    state: ensureExecutionDiagram(state, diagram),
    node: currentNode,
    variables: state.variables,
    message: `Avanzando desde "${currentNode.data.label}".`,
  });
}

export function resumeFlowExecutionWithInput({
  state,
  value,
}: {
  state: FlowExecutionState;
  value: ExecutionValue;
}): FlowExecutionState {
  if (!state.pendingInput) {
    return state;
  }

  const variableName = state.pendingInput.variableName;

  return {
    ...state,
    currentNodeId: state.pendingInput.nextNodeId,
    variables: {
      ...state.variables,
      [variableName]: value,
    },
    status: "running",
    message: `Entrada guardada en "${variableName}".`,
    activeEdgeId: state.pendingInput.edgeId ?? null,
    pendingInput: null,
  };
}

function ensureExecutionDiagram(
  state: FlowExecutionState,
  diagram: FlowEditorDiagram & { id?: string; name?: string },
): FlowExecutionState {
  return {
    ...state,
    currentDiagramId: diagram.id ?? state.currentDiagramId,
    currentDiagramName: diagram.name ?? state.currentDiagramName,
  };
}

function advanceToNextNode({
  graphEdges,
  state,
  node,
  variables,
  message,
}: {
  graphEdges: FlowConnectionLike[];
  state: FlowExecutionState;
  node: FlowEditorNode;
  variables: ExecutionVariables;
  message: string;
}) {
  const nextEdge = getSingleNextEdge(graphEdges, node.id);

  if (!nextEdge) {
    return {
      ...state,
      status: "error",
      message: `El bloque "${node.data.label}" no tiene salida para continuar.`,
    } satisfies FlowExecutionState;
  }

  return recordStep({
    state,
    node,
    variables,
    message,
    nextNodeId: nextEdge.target,
    edgeId: nextEdge.id,
  });
}

function pauseForInput({
  graphEdges,
  state,
  node,
}: {
  graphEdges: FlowConnectionLike[];
  state: FlowExecutionState;
  node: FlowEditorNode;
}) {
  const config = getInputNodeConfig(node);
  const variableName = config.variableName.trim();
  const nextEdge = getSingleNextEdge(graphEdges, node.id);

  if (!variableName) {
    return {
      ...state,
      status: "error",
      message: "El bloque Entrada necesita un nombre de variable.",
    } satisfies FlowExecutionState;
  }

  if (!nextEdge) {
    return {
      ...state,
      status: "error",
      message: `El bloque "${node.data.label}" no tiene salida para continuar.`,
    } satisfies FlowExecutionState;
  }

  return recordStep({
    state,
    node,
    variables: state.variables,
    message: `Esperando entrada para "${variableName}".`,
    nextNodeId: node.id,
    status: "waitingInput",
    pendingInput: {
      nodeId: node.id,
      prompt: config.prompt || "Ingresa un valor",
      variableName,
      inputType: config.inputType,
      nextNodeId: nextEdge.target,
      edgeId: nextEdge.id,
    },
  });
}

function executeOutputNode({
  graphEdges,
  state,
  node,
}: {
  graphEdges: FlowConnectionLike[];
  state: FlowExecutionState;
  node: FlowEditorNode;
}) {
  const config = getOutputNodeConfig(node);
  const outputResult =
    config.outputMode === "text"
      ? { ok: true as const, value: config.expression }
      : evaluateExpression(config.expression, state.variables);

  if (!outputResult.ok) {
    return {
      ...state,
      status: "error",
      message: outputResult.message,
    } satisfies FlowExecutionState;
  }

  const content = String(outputResult.value ?? "");
  const nextStep = state.stepCount + 1;

  return advanceToNextNode({
    graphEdges,
    state: {
      ...state,
      outputs: [
        ...state.outputs,
        {
          id: `${nextStep}-${node.id}-output`,
          step: nextStep,
          content,
        },
      ],
    },
    node,
    variables: state.variables,
    message: `Salida: ${content}`,
  });
}

function executeFunctionCallNode({
  graphEdges,
  program,
  state,
  node,
}: {
  graphEdges: FlowConnectionLike[];
  program: FlowProgram;
  state: FlowExecutionState;
  node: FlowEditorNode;
}) {
  const config = getFunctionCallNodeConfig(node);
  const flowFunction = program.functions.find(
    (item) => item.id === config.functionId,
  );

  if (!flowFunction) {
    return {
      ...state,
      status: "error",
      message: "La llamada no referencia una funcion existente.",
    } satisfies FlowExecutionState;
  }

  if (config.args.length !== flowFunction.parameters.length) {
    return {
      ...state,
      status: "error",
      message: `La funcion "${flowFunction.name}" espera ${flowFunction.parameters.length} argumento(s), pero la llamada tiene ${config.args.length}.`,
    } satisfies FlowExecutionState;
  }

  const argumentValues: ExecutionValue[] = [];

  for (const argument of config.args) {
    const argumentResult = evaluateExpression(argument, state.variables);

    if (!argumentResult.ok) {
      return {
        ...state,
        status: "error",
        message: argumentResult.message,
      } satisfies FlowExecutionState;
    }

    argumentValues.push(argumentResult.value);
  }

  const functionStartNode = flowFunction.nodes.find(
    (item) => item.type === "start",
  );

  if (!functionStartNode) {
    return {
      ...state,
      status: "error",
      message: `La funcion "${flowFunction.name}" no tiene bloque Inicio.`,
    } satisfies FlowExecutionState;
  }

  const nextEdge = getSingleNextEdge(graphEdges, node.id);
  const localVariables = Object.fromEntries(
    flowFunction.parameters.map((parameter, index) => [
      parameter,
      argumentValues[index],
    ]),
  );

  return recordStep({
    state,
    node,
    variables: localVariables,
    message: `Entrando a la funcion "${flowFunction.name}".`,
    nextNodeId: functionStartNode.id,
    edgeId: undefined,
    currentDiagramId: flowFunction.id,
    currentDiagramName: `Funcion ${flowFunction.name}`,
    callStack: [
      ...state.callStack,
      {
        diagramId: state.currentDiagramId,
        diagramName: state.currentDiagramName,
        currentNodeId: nextEdge?.target ?? null,
        variables: state.variables,
        returnEdgeId: nextEdge?.id,
        assignTo: config.assignTo?.trim() || undefined,
      },
    ],
    activeDecision: null,
  });
}

function executeReturnNode({
  state,
  node,
}: {
  state: FlowExecutionState;
  node: FlowEditorNode;
}) {
  const config = getReturnNodeConfig(node);
  const expression = config.expression.trim();
  const returnValueResult = expression
    ? evaluateExpression(expression, state.variables)
    : { ok: true as const, value: undefined };

  if (!returnValueResult.ok) {
    return {
      ...state,
      status: "error",
      message: returnValueResult.message,
    } satisfies FlowExecutionState;
  }

  return returnToCaller({
    state,
    node,
    value: returnValueResult.value,
  });
}

function returnToCaller({
  state,
  node,
  value,
}: {
  state: FlowExecutionState;
  node: FlowEditorNode;
  value: ExecutionValue;
}) {
  const callerFrame = state.callStack.at(-1);

  if (!callerFrame) {
    return recordStep({
      state,
      node,
      variables: state.variables,
      message:
        node.type === "return"
          ? "Retorno ejecutado en el flujo principal."
          : "Ejecucion finalizada.",
      status: "finished",
    });
  }

  const nextCallStack = state.callStack.slice(0, -1);
  const nextVariables = callerFrame.assignTo
    ? {
        ...callerFrame.variables,
        [callerFrame.assignTo]: value,
      }
    : callerFrame.variables;

  return recordStep({
    state,
    node,
    variables: nextVariables,
    message: callerFrame.assignTo
      ? `Retorno guardado en "${callerFrame.assignTo}".`
      : "Retorno completado.",
    nextNodeId: callerFrame.currentNodeId,
    edgeId: callerFrame.returnEdgeId,
    status: callerFrame.currentNodeId ? "running" : "finished",
    currentDiagramId: callerFrame.diagramId,
    currentDiagramName: callerFrame.diagramName,
    callStack: nextCallStack,
    activeDecision: null,
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
  currentDiagramId = state.currentDiagramId,
  currentDiagramName = state.currentDiagramName,
  callStack = state.callStack,
  pendingInput = null,
}: {
  state: FlowExecutionState;
  node: FlowEditorNode;
  variables: ExecutionVariables;
  message: string;
  nextNodeId?: string | null;
  edgeId?: string;
  branchLabel?: "Si" | "No";
  activeDecision?: FlowExecutionState["activeDecision"];
  status?: FlowExecutionState["status"];
  currentDiagramId?: string;
  currentDiagramName?: string;
  callStack?: FlowExecutionCallFrame[];
  pendingInput?: FlowExecutionPendingInput | null;
}): FlowExecutionState {
  const nextStep = state.stepCount + 1;
  const historyItem: FlowExecutionHistoryItem = {
    id: `${nextStep}-${node.id}`,
    step: nextStep,
    nodeId: node.id,
    nodeType: node.type,
    diagramName: state.currentDiagramName,
    content: getNodeExecutionContent(node),
    message,
    variables,
    edgeId,
    branchLabel,
  };

  return {
    ...state,
    currentNodeId: nextNodeId,
    currentDiagramId,
    currentDiagramName,
    variables,
    history: [...state.history, historyItem],
    status,
    message,
    stepCount: nextStep,
    activeEdgeId: edgeId ?? null,
    activeDecision,
    callStack,
    pendingInput,
  };
}

function getDiagramById(
  program: FlowProgram,
  diagramId: string,
): (FlowEditorDiagram & { id: string; name: string }) | null {
  if (diagramId === "main") {
    return {
      ...program.main,
      id: "main",
      name: "Principal",
    };
  }

  const flowFunction = program.functions.find((item) => item.id === diagramId);

  if (!flowFunction) {
    return null;
  }

  return {
    id: flowFunction.id,
    name: `Funcion ${flowFunction.name}`,
    nodes: flowFunction.nodes,
    edges: flowFunction.edges,
  };
}

function getNodeExecutionContent(node: FlowEditorNode) {
  if (node.type === "process" && "instruction" in node.data.config) {
    return node.data.config.instruction;
  }

  if (node.type === "decision" && "condition" in node.data.config) {
    return node.data.config.condition;
  }

  if (node.type === "input" && "variableName" in node.data.config) {
    return `${node.data.config.variableName} <- entrada`;
  }

  if (node.type === "output" && "expression" in node.data.config) {
    return node.data.config.expression;
  }

  if (node.type === "functionCall" && "functionId" in node.data.config) {
    return `llamar funcion(${node.data.config.args.join(", ")})`;
  }

  if (node.type === "return" && "expression" in node.data.config) {
    return `return ${node.data.config.expression}`;
  }

  return node.data.label;
}

function getSingleNextEdge(edges: FlowConnectionLike[], nodeId: string) {
  return edges.find((edge) => edge.source === nodeId);
}

function getInputNodeConfig(node: FlowEditorNode): InputNodeConfig {
  return "prompt" in node.data.config
    ? (node.data.config as InputNodeConfig)
    : {
        prompt: "Ingresa un valor",
        variableName: "valor",
        inputType: "text",
      };
}

function getOutputNodeConfig(node: FlowEditorNode): OutputNodeConfig {
  return "outputMode" in node.data.config
    ? (node.data.config as OutputNodeConfig)
    : {
        expression: node.data.label,
        outputMode: "text",
      };
}

function getFunctionCallNodeConfig(
  node: FlowEditorNode,
): FunctionCallNodeConfig {
  return "functionId" in node.data.config
    ? (node.data.config as FunctionCallNodeConfig)
    : {
        functionId: "",
        args: [],
        assignTo: "",
      };
}

function getReturnNodeConfig(node: FlowEditorNode): ReturnNodeConfig {
  return "expression" in node.data.config && !("outputMode" in node.data.config)
    ? (node.data.config as ReturnNodeConfig)
    : {
        expression: "",
      };
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
      message: `Instruccion no soportada: "${instruction}". Usa asignaciones o declaraciones como x = 5, let x = 5 o x = x + 1.`,
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

export function evaluateExpression(
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
        message: `Expresion no soportada: "${expression}". ${error.message}`,
      };
    }

    return {
      ok: false,
      message: `Expresion no soportada: "${expression}".`,
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
      message: `No se encontro la variable "${expression.name}".`,
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
    message: `La expresion "${expression.type}" todavia no esta soportada.`,
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
      message: "Los campos privados no estan soportados en expresiones.",
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
      message: `El operador "${operator}" solo soporta numeros en esta version.`,
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
      message: `El operador "${operator}" solo soporta numeros en esta version.`,
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
        message: `El operador "${operator}" necesita numeros o textos comparables.`,
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

function isComparableValue(value: ExecutionValue): value is number | string {
  return typeof value === "number" || typeof value === "string";
}
