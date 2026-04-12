import { parseExpression } from "@babel/parser";
import type {
  AssignmentExpression,
  BinaryExpression,
  Expression,
  LogicalExpression,
  UpdateExpression,
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

type ExpressionEvaluationResult =
  | {
      ok: true;
      value: ExecutionValue;
      variables: ExecutionVariables;
    }
  | {
      ok: false;
      message: string;
    };

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
  inheritedVariableNames: string[];
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
      variables: conditionResult.variables,
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
      ? {
          ok: true as const,
          value: config.expression,
          variables: state.variables,
        }
      : evaluateExpressionWithVariables(config.expression, state.variables);

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
    variables: outputResult.variables,
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
  let argumentVariables = state.variables;

  for (const argument of config.args) {
    const argumentResult = evaluateExpressionWithVariables(
      argument,
      argumentVariables,
    );

    if (!argumentResult.ok) {
      return {
        ...state,
        status: "error",
        message: argumentResult.message,
      } satisfies FlowExecutionState;
    }

    argumentValues.push(argumentResult.value);
    argumentVariables = argumentResult.variables;
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
  const parameterVariables = Object.fromEntries(
    flowFunction.parameters.map((parameter, index) => [
      parameter,
      argumentValues[index],
    ]),
  );
  const parameterNames = new Set(flowFunction.parameters);
  const inheritedVariableNames = Object.keys(argumentVariables).filter(
    (variableName) => !parameterNames.has(variableName),
  );
  const localVariables = {
    ...argumentVariables,
    ...parameterVariables,
  };

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
        variables: argumentVariables,
        inheritedVariableNames,
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
  const expression = getReturnExpression(config.expression);
  const returnValueResult = expression
    ? evaluateExpressionWithVariables(expression, state.variables)
    : {
        ok: true as const,
        value: undefined,
        variables: state.variables,
      };

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
    variables: returnValueResult.variables,
  });
}

function returnToCaller({
  state,
  node,
  value,
  variables = state.variables,
}: {
  state: FlowExecutionState;
  node: FlowEditorNode;
  value: ExecutionValue;
  variables?: ExecutionVariables;
}) {
  const callerFrame = state.callStack.at(-1);

  if (!callerFrame) {
    return recordStep({
      state,
      node,
      variables,
      message:
        node.type === "return"
          ? "Retorno ejecutado en el flujo principal."
          : "Ejecucion finalizada.",
      status: "finished",
    });
  }

  const nextCallStack = state.callStack.slice(0, -1);
  const callerVariablesWithInheritedChanges = mergeInheritedVariables(
    callerFrame.variables,
    variables,
    callerFrame.inheritedVariableNames,
  );
  const nextVariables = callerFrame.assignTo
    ? {
        ...callerVariablesWithInheritedChanges,
        [callerFrame.assignTo]: value,
      }
    : callerVariablesWithInheritedChanges;

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

function mergeInheritedVariables(
  callerVariables: ExecutionVariables,
  functionVariables: ExecutionVariables,
  inheritedVariableNames: string[],
) {
  return inheritedVariableNames.reduce<ExecutionVariables>(
    (nextVariables, variableName) =>
      variableName in functionVariables
        ? {
            ...nextVariables,
            [variableName]: functionVariables[variableName],
          }
        : nextVariables,
    callerVariables,
  );
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
  const trimmedInstruction = trimExpressionText(instruction);
  const declarationMatch = trimmedInstruction.match(
    /^(let|const|var)\s+([A-Za-z_$][\w$]*)(?:\s*=\s*(.+))?$/,
  );

  if (!trimmedInstruction) {
    return {
      ok: false,
      message:
        "Instruccion vacia. Usa asignaciones, actualizaciones o declaraciones como x = 5, x++, x += 1 o let x = 5.",
    };
  }

  if (declarationMatch) {
    const [, , variableName, expression] = declarationMatch;

    if (!expression) {
      return {
        ok: true,
        variables: {
          ...variables,
          [variableName]: undefined,
        },
      };
    }

    const expressionResult = evaluateExpressionWithVariables(
      expression,
      variables,
    );

    if (!expressionResult.ok) {
      return expressionResult;
    }

    return {
      ok: true,
      variables: {
        ...expressionResult.variables,
        [variableName]: expressionResult.value,
      },
    };
  }

  try {
    const expression = parseExpression(trimmedInstruction, {
      sourceType: "unambiguous",
    });

    if (
      expression.type !== "AssignmentExpression" &&
      expression.type !== "UpdateExpression"
    ) {
      return {
        ok: false,
        message: `Instruccion no soportada: "${instruction}". Usa asignaciones, actualizaciones o declaraciones como x = 5, x++, x += 1 o let x = 5.`,
      };
    }

    const expressionResult = evaluateExpressionNode(expression, variables);

    if (!expressionResult.ok) {
      return expressionResult;
    }

    return {
      ok: true,
      variables: expressionResult.variables,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        ok: false,
        message: `Instruccion no soportada: "${instruction}". ${error.message}`,
      };
    }

    return {
      ok: false,
      message: `Instruccion no soportada: "${instruction}".`,
    };
  }
}

function evaluateCondition(
  condition: string,
  variables: ExecutionVariables,
):
  | { ok: true; value: boolean; variables: ExecutionVariables }
  | { ok: false; message: string } {
  const conditionResult = evaluateExpressionWithVariables(condition, variables);

  if (!conditionResult.ok) {
    return conditionResult;
  }

  return {
    ok: true,
    value: Boolean(conditionResult.value),
    variables: conditionResult.variables,
  };
}

export function evaluateExpression(
  expression: string,
  variables: ExecutionVariables,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  const result = evaluateExpressionWithVariables(expression, variables);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    value: result.value,
  };
}

function evaluateExpressionWithVariables(
  expression: string,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  const trimmedExpression = trimExpressionText(expression);

  try {
    return evaluateExpressionNode(
      parseExpression(trimmedExpression, {
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

function trimExpressionText(expression: string) {
  return expression.trim().replace(/;$/, "").trim();
}

function getReturnExpression(expression: string) {
  const trimmedExpression = trimExpressionText(expression);

  return trimmedExpression.replace(/^return\b\s*/, "");
}

function evaluateExpressionNode(
  expression: Expression,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  if (expression.type === "Identifier") {
    if (expression.name in variables) {
      return createExpressionValue(variables[expression.name], variables);
    }

    return {
      ok: false,
      message: `No se encontro la variable "${expression.name}".`,
    };
  }

  if (expression.type === "NumericLiteral") {
    return createExpressionValue(expression.value, variables);
  }

  if (expression.type === "StringLiteral") {
    return createExpressionValue(expression.value, variables);
  }

  if (expression.type === "BooleanLiteral") {
    return createExpressionValue(expression.value, variables);
  }

  if (expression.type === "NullLiteral") {
    return createExpressionValue(null, variables);
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

  if (expression.type === "AssignmentExpression") {
    return evaluateAssignmentExpression(expression, variables);
  }

  if (expression.type === "UpdateExpression") {
    return evaluateUpdateExpression(expression, variables);
  }

  return {
    ok: false,
    message: `La expresion "${expression.type}" todavia no esta soportada.`,
  };
}

function evaluateUnaryExpression(
  expression: Extract<Expression, { type: "UnaryExpression" }>,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  const argumentResult = evaluateExpressionNode(expression.argument, variables);

  if (!argumentResult.ok) {
    return argumentResult;
  }

  switch (expression.operator) {
    case "!":
      return createExpressionValue(
        !argumentResult.value,
        argumentResult.variables,
      );
    case "+":
      return applyUnaryNumberOperator(
        argumentResult.value,
        "+",
        argumentResult.variables,
      );
    case "-":
      return applyUnaryNumberOperator(
        argumentResult.value,
        "-",
        argumentResult.variables,
      );
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
): ExpressionEvaluationResult {
  const leftResult = evaluateExpressionNode(expression.left, variables);

  if (!leftResult.ok) {
    return leftResult;
  }

  if (expression.operator === "&&" && !leftResult.value) {
    return createExpressionValue(leftResult.value, leftResult.variables);
  }

  if (expression.operator === "||" && leftResult.value) {
    return createExpressionValue(leftResult.value, leftResult.variables);
  }

  if (
    expression.operator === "??" &&
    leftResult.value !== null &&
    leftResult.value !== undefined
  ) {
    return createExpressionValue(leftResult.value, leftResult.variables);
  }

  return evaluateExpressionNode(expression.right, leftResult.variables);
}

function evaluateBinaryExpression(
  expression: BinaryExpression,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  if (expression.left.type === "PrivateName") {
    return {
      ok: false,
      message: "Los campos privados no estan soportados en expresiones.",
    };
  }

  const leftResult = evaluateExpressionNode(expression.left, variables);

  if (!leftResult.ok) {
    return leftResult;
  }

  const rightResult = evaluateExpressionNode(
    expression.right,
    leftResult.variables,
  );

  if (!rightResult.ok) {
    return rightResult;
  }

  if (isArithmeticOperator(expression.operator)) {
    return applyArithmeticOperator(
      leftResult.value,
      expression.operator,
      rightResult.value,
      rightResult.variables,
    );
  }

  if (isComparisonOperator(expression.operator)) {
    return applyComparisonOperator(
      leftResult.value,
      expression.operator,
      rightResult.value,
      rightResult.variables,
    );
  }

  return {
    ok: false,
    message: `Operador no soportado: "${expression.operator}".`,
  };
}

function evaluateAssignmentExpression(
  expression: AssignmentExpression,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  if (expression.left.type !== "Identifier") {
    return {
      ok: false,
      message: "Solo se pueden asignar variables simples como x = 5.",
    };
  }

  const variableName = expression.left.name;
  const previousValue = variables[variableName];
  const rightResult = evaluateExpressionNode(expression.right, variables);

  if (!rightResult.ok) {
    return rightResult;
  }

  if (expression.operator === "=") {
    return createExpressionValue(rightResult.value, {
      ...rightResult.variables,
      [variableName]: rightResult.value,
    });
  }

  const arithmeticOperator = expression.operator.slice(0, -1);
  const assignmentResult = applyArithmeticOperator(
    previousValue,
    arithmeticOperator,
    rightResult.value,
    rightResult.variables,
  );

  if (!assignmentResult.ok) {
    return assignmentResult;
  }

  return createExpressionValue(assignmentResult.value, {
    ...assignmentResult.variables,
    [variableName]: assignmentResult.value,
  });
}

function evaluateUpdateExpression(
  expression: UpdateExpression,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  if (expression.argument.type !== "Identifier") {
    return {
      ok: false,
      message: "Los operadores ++ y -- solo soportan variables simples.",
    };
  }

  const variableName = expression.argument.name;

  if (!(variableName in variables)) {
    return {
      ok: false,
      message: `No se encontro la variable "${variableName}".`,
    };
  }

  const currentValue = variables[variableName];

  if (typeof currentValue !== "number") {
    return {
      ok: false,
      message: `El operador "${expression.operator}" solo soporta numeros en esta version.`,
    };
  }

  const nextValue =
    expression.operator === "++" ? currentValue + 1 : currentValue - 1;

  return createExpressionValue(nextValue, {
    ...variables,
    [variableName]: nextValue,
  });
}

function applyUnaryNumberOperator(
  value: ExecutionValue,
  operator: "+" | "-",
  variables: ExecutionVariables,
) {
  if (typeof value !== "number") {
    return {
      ok: false,
      message: `El operador "${operator}" solo soporta numeros en esta version.`,
    } as const;
  }

  return {
    ok: true,
    value: operator === "-" ? -value : value,
    variables,
  } as const;
}

function applyArithmeticOperator(
  leftValue: ExecutionValue,
  operator: string,
  rightValue: ExecutionValue,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  if (
    operator === "+" &&
    (typeof leftValue === "string" || typeof rightValue === "string")
  ) {
    return createExpressionValue(`${leftValue}${rightValue}`, variables);
  }

  if (typeof leftValue !== "number" || typeof rightValue !== "number") {
    return {
      ok: false,
      message: `El operador "${operator}" solo soporta numeros en esta version.`,
    };
  }

  switch (operator) {
    case "+":
      return createExpressionValue(leftValue + rightValue, variables);
    case "-":
      return createExpressionValue(leftValue - rightValue, variables);
    case "*":
      return createExpressionValue(leftValue * rightValue, variables);
    case "/":
      return createExpressionValue(leftValue / rightValue, variables);
    case "%":
      return createExpressionValue(leftValue % rightValue, variables);
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
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  if (isRelationalOperator(operator)) {
    if (!isComparableValue(leftValue) || !isComparableValue(rightValue)) {
      return {
        ok: false,
        message: `El operador "${operator}" necesita numeros o textos comparables.`,
      };
    }

    switch (operator) {
      case ">":
        return createExpressionValue(leftValue > rightValue, variables);
      case "<":
        return createExpressionValue(leftValue < rightValue, variables);
      case ">=":
        return createExpressionValue(leftValue >= rightValue, variables);
      case "<=":
        return createExpressionValue(leftValue <= rightValue, variables);
    }
  }

  switch (operator) {
    case "===":
      return createExpressionValue(leftValue === rightValue, variables);
    case "!==":
      return createExpressionValue(leftValue !== rightValue, variables);
    case "==":
      return createExpressionValue(leftValue == rightValue, variables);
    case "!=":
      return createExpressionValue(leftValue != rightValue, variables);
    default:
      return {
        ok: false,
        message: `Operador no soportado: "${operator}".`,
      };
  }
}

function createExpressionValue(
  value: ExecutionValue,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  return {
    ok: true,
    value,
    variables,
  };
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
