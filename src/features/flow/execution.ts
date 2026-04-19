import { parseExpression } from "@babel/parser";
import type {
  AssignmentExpression,
  ArrowFunctionExpression,
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  Expression,
  FunctionExpression,
  LogicalExpression,
  MemberExpression,
  ObjectProperty,
  OptionalCallExpression,
  OptionalMemberExpression,
  SequenceExpression,
  TemplateLiteral,
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
  FlowFunctionParameterDefinition,
} from "@/types/flow";

export type ExecutionPrimitive = number | string | boolean | null | undefined;
export type ExecutionArray = ExecutionValue[];
export type ExecutionObject = { [key: string]: ExecutionValue };
export type ExecutionValue =
  | ExecutionPrimitive
  | ExecutionArray
  | ExecutionObject;
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

export type FlowExecutionPendingFunctionParameters = {
  functionId: string;
  functionName: string;
  parameters: FlowFunctionParameterDefinition[];
};

export type FlowExecutionFunctionParameterValues = Record<
  string,
  ExecutionValue
>;

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
  pendingFunctionParameters: FlowExecutionPendingFunctionParameters | null;
  status:
    | "idle"
    | "running"
    | "waitingInput"
    | "waitingFunctionParameters"
    | "finished"
    | "error";
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
  pendingFunctionParameters: null,
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
    state.status === "waitingInput" ||
    state.status === "waitingFunctionParameters"
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

  if (state.status === "idle" && activeDiagramId !== "main") {
    const activeFunction = program.functions.find(
      (flowFunction) => flowFunction.id === activeDiagramId,
    );

    if (activeFunction) {
      const parameterDefinitions =
        getFunctionParameterDefinitions(activeFunction);

      if (parameterDefinitions.length > 0) {
        return {
          ...state,
          currentDiagramId: activeFunction.id,
          currentDiagramName: `Funcion ${activeFunction.name}`,
          status: "waitingFunctionParameters",
          message: `Ingresa los parametros de "${activeFunction.name}".`,
          pendingFunctionParameters: {
            functionId: activeFunction.id,
            functionName: activeFunction.name,
            parameters: parameterDefinitions,
          },
        };
      }
    }
  }

  const diagramId =
    state.status === "idle" ? activeDiagramId : state.currentDiagramId;
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
    if (state.callStack.length > 0 || diagram.id !== "main") {
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

export function resumeFlowExecutionWithFunctionParameters({
  state,
  values,
}: {
  state: FlowExecutionState;
  values: FlowExecutionFunctionParameterValues;
}): FlowExecutionState {
  if (!state.pendingFunctionParameters) {
    return state;
  }

  const parameterBindingResult = bindStandaloneFunctionParameters(
    state.pendingFunctionParameters.parameters,
    values,
  );

  if (!parameterBindingResult.ok) {
    return {
      ...state,
      status: "error",
      message: parameterBindingResult.message,
    };
  }

  return {
    ...state,
    currentNodeId: null,
    currentDiagramId: state.pendingFunctionParameters.functionId,
    currentDiagramName: `Funcion ${state.pendingFunctionParameters.functionName}`,
    variables: parameterBindingResult.variables,
    status: "running",
    message: `Parametros cargados para "${state.pendingFunctionParameters.functionName}".`,
    activeEdgeId: null,
    activeDecision: null,
    pendingInput: null,
    pendingFunctionParameters: null,
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

  const parameterDefinitions = getFunctionParameterDefinitions(flowFunction);
  const argumentCountValidation = validateFunctionArgumentCount(
    flowFunction.name,
    parameterDefinitions,
    config.args.length,
  );

  if (!argumentCountValidation.ok) {
    return {
      ...state,
      status: "error",
      message: argumentCountValidation.message,
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
  const parameterBindingResult = bindFunctionParameters(
    parameterDefinitions,
    argumentValues,
    argumentVariables,
  );

  if (!parameterBindingResult.ok) {
    return {
      ...state,
      status: "error",
      message: parameterBindingResult.message,
    } satisfies FlowExecutionState;
  }

  const parameterNames = new Set(
    parameterDefinitions.map((parameter) => parameter.name),
  );
  const inheritedVariableNames = Object.keys(argumentVariables).filter(
    (variableName) => !parameterNames.has(variableName),
  );
  const localVariables = {
    ...parameterBindingResult.variables,
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
    const isStandaloneFunctionReturn = state.currentDiagramId !== "main";
    const nextStep = state.stepCount + 1;
    const stateWithReturnOutput = isStandaloneFunctionReturn
      ? {
          ...state,
          outputs: [
            ...state.outputs,
            {
              id: `${nextStep}-${node.id}-return`,
              step: nextStep,
              content: `return ${formatExecutionValue(value)}`,
            },
          ],
        }
      : state;

    return recordStep({
      state: stateWithReturnOutput,
      node,
      variables,
      message:
        node.type === "return" || isStandaloneFunctionReturn
          ? `Retorno: ${formatExecutionValue(value)}.`
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

function getFunctionParameterDefinitions(
  flowFunction: FlowProgram["functions"][number],
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
    const name = trimmedParameter.slice(3).trim();

    return {
      name,
      source: trimmedParameter,
      rest: true,
    };
  }

  const defaultSeparatorIndex = trimmedParameter.indexOf("=");

  if (defaultSeparatorIndex >= 0) {
    const name = trimmedParameter.slice(0, defaultSeparatorIndex).trim();
    const defaultValue = trimmedParameter
      .slice(defaultSeparatorIndex + 1)
      .trim();

    return {
      name,
      source: trimmedParameter,
      defaultValue,
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

function bindFunctionParameters(
  parameters: FlowFunctionParameterDefinition[],
  argumentValues: ExecutionValue[],
  variables: ExecutionVariables,
):
  | { ok: true; variables: ExecutionVariables }
  | { ok: false; message: string } {
  let nextVariables = { ...variables };
  let argumentIndex = 0;

  for (const parameter of parameters) {
    if (!parameter.name) {
      return {
        ok: false,
        message: "Una funcion tiene un parametro sin nombre.",
      };
    }

    if (parameter.rest) {
      nextVariables = {
        ...nextVariables,
        [parameter.name]: argumentValues.slice(argumentIndex),
      };
      argumentIndex = argumentValues.length;
      continue;
    }

    if (argumentIndex < argumentValues.length) {
      nextVariables = {
        ...nextVariables,
        [parameter.name]: argumentValues[argumentIndex],
      };
      argumentIndex += 1;
      continue;
    }

    if (parameter.defaultValue !== undefined) {
      const defaultResult = evaluateExpressionWithVariables(
        parameter.defaultValue,
        nextVariables,
      );

      if (!defaultResult.ok) {
        return defaultResult;
      }

      nextVariables = {
        ...defaultResult.variables,
        [parameter.name]: defaultResult.value,
      };
      continue;
    }

    nextVariables = {
      ...nextVariables,
      [parameter.name]: undefined,
    };
  }

  return {
    ok: true,
    variables: nextVariables,
  };
}

function bindStandaloneFunctionParameters(
  parameters: FlowFunctionParameterDefinition[],
  values: FlowExecutionFunctionParameterValues,
):
  | { ok: true; variables: ExecutionVariables }
  | { ok: false; message: string } {
  let nextVariables: ExecutionVariables = {};

  for (const parameter of parameters) {
    if (!parameter.name) {
      return {
        ok: false,
        message: "Una funcion tiene un parametro sin nombre.",
      };
    }

    if (parameter.rest) {
      const restValue = hasOwnValue(values, parameter.name)
        ? values[parameter.name]
        : [];

      if (!Array.isArray(restValue)) {
        return {
          ok: false,
          message: `El parametro rest "${parameter.name}" debe recibir un arreglo.`,
        };
      }

      nextVariables = {
        ...nextVariables,
        [parameter.name]: restValue,
      };
      continue;
    }

    if (hasOwnValue(values, parameter.name)) {
      nextVariables = {
        ...nextVariables,
        [parameter.name]: values[parameter.name],
      };
      continue;
    }

    if (parameter.defaultValue !== undefined) {
      const defaultResult = evaluateExpressionWithVariables(
        parameter.defaultValue,
        nextVariables,
      );

      if (!defaultResult.ok) {
        return defaultResult;
      }

      nextVariables = {
        ...defaultResult.variables,
        [parameter.name]: defaultResult.value,
      };
      continue;
    }

    return {
      ok: false,
      message: `Falta un valor para el parametro "${parameter.name}".`,
    };
  }

  return {
    ok: true,
    variables: nextVariables,
  };
}

function hasOwnValue(
  values: FlowExecutionFunctionParameterValues,
  name: string,
) {
  return Object.prototype.hasOwnProperty.call(values, name);
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
  pendingFunctionParameters = null,
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
  pendingFunctionParameters?: FlowExecutionPendingFunctionParameters | null;
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
    pendingFunctionParameters,
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
        "Instruccion vacia. Usa asignaciones, llamadas seguras, actualizaciones o declaraciones como x = 5, arr.push(1), x++ o let x = 5.",
    };
  }

  if (trimmedInstruction === "break" || trimmedInstruction === "continue") {
    return {
      ok: true,
      variables,
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
      expression.type !== "UpdateExpression" &&
      expression.type !== "SequenceExpression" &&
      expression.type !== "CallExpression" &&
      expression.type !== "OptionalCallExpression"
    ) {
      return {
        ok: false,
        message: `Instruccion no soportada: "${instruction}". Usa asignaciones, llamadas seguras, actualizaciones o declaraciones como x = 5, arr.push(1), x++ o let x = 5.`,
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
    if (expression.name === "undefined") {
      return createExpressionValue(undefined, variables);
    }

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

  if (expression.type === "ConditionalExpression") {
    return evaluateConditionalExpression(expression, variables);
  }

  if (expression.type === "BinaryExpression") {
    return evaluateBinaryExpression(expression, variables);
  }

  if (
    expression.type === "MemberExpression" ||
    expression.type === "OptionalMemberExpression"
  ) {
    return evaluateMemberExpression(expression, variables);
  }

  if (expression.type === "ArrayExpression") {
    return evaluateArrayExpression(expression, variables);
  }

  if (expression.type === "ObjectExpression") {
    return evaluateObjectExpression(expression, variables);
  }

  if (expression.type === "TemplateLiteral") {
    return evaluateTemplateLiteral(expression, variables);
  }

  if (
    expression.type === "CallExpression" ||
    expression.type === "OptionalCallExpression"
  ) {
    return evaluateCallExpression(expression, variables);
  }

  if (expression.type === "SequenceExpression") {
    return evaluateSequenceExpression(expression, variables);
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
    case "~":
      return applyUnaryBitwiseOperator(
        argumentResult.value,
        expression.operator,
        argumentResult.variables,
      );
    case "typeof":
      return createExpressionValue(
        getExecutionTypeName(argumentResult.value),
        argumentResult.variables,
      );
    case "void":
      return createExpressionValue(undefined, argumentResult.variables);
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

function evaluateConditionalExpression(
  expression: ConditionalExpression,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  const testResult = evaluateExpressionNode(expression.test, variables);

  if (!testResult.ok) {
    return testResult;
  }

  return evaluateExpressionNode(
    testResult.value ? expression.consequent : expression.alternate,
    testResult.variables,
  );
}

function evaluateSequenceExpression(
  expression: SequenceExpression,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  let currentVariables = variables;
  let currentValue: ExecutionValue = undefined;

  for (const item of expression.expressions) {
    const itemResult = evaluateExpressionNode(item, currentVariables);

    if (!itemResult.ok) {
      return itemResult;
    }

    currentValue = itemResult.value;
    currentVariables = itemResult.variables;
  }

  return createExpressionValue(currentValue, currentVariables);
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

  if (isBitwiseOperator(expression.operator)) {
    return applyBitwiseOperator(
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
  if (!isSupportedAssignmentTarget(expression.left)) {
    return {
      ok: false,
      message:
        "Solo se pueden asignar variables o propiedades como x = 5, obj.prop = 5 o arr[i] = 5.",
    };
  }

  const rightResult = evaluateExpressionNode(expression.right, variables);

  if (!rightResult.ok) {
    return rightResult;
  }

  const nextVariables = cloneExecutionVariables(rightResult.variables);
  const targetResult = resolveAssignmentTarget(expression.left, nextVariables);

  if (!targetResult.ok) {
    return targetResult;
  }

  if (expression.operator === "=") {
    setAssignmentTargetValue(targetResult.target, rightResult.value);

    return createExpressionValue(rightResult.value, nextVariables);
  }

  const assignmentOperator = expression.operator.slice(0, -1);
  let assignmentResult: ExpressionEvaluationResult;

  if (isArithmeticOperator(assignmentOperator)) {
    assignmentResult = applyArithmeticOperator(
      targetResult.target.value,
      assignmentOperator,
      rightResult.value,
      nextVariables,
    );
  } else if (isBitwiseOperator(assignmentOperator)) {
    assignmentResult = applyBitwiseOperator(
      targetResult.target.value,
      assignmentOperator,
      rightResult.value,
      nextVariables,
    );
  } else {
    return {
      ok: false,
      message: `Asignacion no soportada: "${expression.operator}".`,
    };
  }

  if (!assignmentResult.ok) {
    return assignmentResult;
  }

  setAssignmentTargetValue(targetResult.target, assignmentResult.value);

  return createExpressionValue(assignmentResult.value, nextVariables);
}

function evaluateUpdateExpression(
  expression: UpdateExpression,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  if (!isSupportedAssignmentTarget(expression.argument)) {
    return {
      ok: false,
      message:
        "Los operadores ++ y -- solo soportan variables o propiedades asignables.",
    };
  }

  const nextVariables = cloneExecutionVariables(variables);
  const targetResult = resolveAssignmentTarget(expression.argument, nextVariables);

  if (!targetResult.ok) {
    return targetResult;
  }

  const currentValue = targetResult.target.value;

  if (typeof currentValue !== "number") {
    return {
      ok: false,
      message: `El operador "${expression.operator}" solo soporta numeros en esta version.`,
    };
  }

  const nextValue =
    expression.operator === "++" ? currentValue + 1 : currentValue - 1;
  const resultValue = expression.prefix ? nextValue : currentValue;

  setAssignmentTargetValue(targetResult.target, nextValue);

  return createExpressionValue(resultValue, nextVariables);
}

function evaluateMemberExpression(
  expression: MemberExpression | OptionalMemberExpression,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  const memberResult = evaluateMemberAccess(expression, variables);

  if (!memberResult.ok) {
    return memberResult;
  }

  return createExpressionValue(memberResult.value, memberResult.variables);
}

function evaluateArrayExpression(
  expression: Extract<Expression, { type: "ArrayExpression" }>,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  const values: ExecutionValue[] = [];
  let currentVariables = variables;

  for (const element of expression.elements) {
    if (!element) {
      values.push(undefined);
      continue;
    }

    if (element.type === "SpreadElement") {
      const spreadResult = evaluateExpressionNode(
        element.argument,
        currentVariables,
      );

      if (!spreadResult.ok) {
        return spreadResult;
      }

      if (!Array.isArray(spreadResult.value)) {
        return {
          ok: false,
          message: "El operador spread en arreglos solo soporta arreglos.",
        };
      }

      values.push(...spreadResult.value);
      currentVariables = spreadResult.variables;
      continue;
    }

    const elementResult = evaluateExpressionNode(element, currentVariables);

    if (!elementResult.ok) {
      return elementResult;
    }

    values.push(elementResult.value);
    currentVariables = elementResult.variables;
  }

  return createExpressionValue(values, currentVariables);
}

function evaluateObjectExpression(
  expression: Extract<Expression, { type: "ObjectExpression" }>,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  const value: ExecutionObject = {};
  let currentVariables = variables;

  for (const property of expression.properties) {
    if (property.type === "SpreadElement") {
      const spreadResult = evaluateExpressionNode(
        property.argument,
        currentVariables,
      );

      if (!spreadResult.ok) {
        return spreadResult;
      }

      if (!isPlainExecutionObject(spreadResult.value)) {
        return {
          ok: false,
          message: "El operador spread en objetos solo soporta objetos planos.",
        };
      }

      Object.assign(value, spreadResult.value);
      currentVariables = spreadResult.variables;
      continue;
    }

    if (property.type !== "ObjectProperty") {
      return {
        ok: false,
        message: `La propiedad de objeto "${property.type}" todavia no esta soportada.`,
      };
    }

    const keyResult = getObjectPropertyKey(property, currentVariables);

    if (!keyResult.ok) {
      return keyResult;
    }

    const valueResult = evaluateExpressionNode(
      property.value as Expression,
      keyResult.variables,
    );

    if (!valueResult.ok) {
      return valueResult;
    }

    value[keyResult.key] = valueResult.value;
    currentVariables = valueResult.variables;
  }

  return createExpressionValue(value, currentVariables);
}

function evaluateTemplateLiteral(
  expression: TemplateLiteral,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  let currentVariables = variables;
  let value = "";

  for (let index = 0; index < expression.quasis.length; index += 1) {
    const quasi = expression.quasis[index];

    value += quasi.value.cooked ?? quasi.value.raw;

    const embeddedExpression = expression.expressions[index];

    if (!embeddedExpression) {
      continue;
    }

    const expressionResult = evaluateExpressionNode(
      embeddedExpression as Expression,
      currentVariables,
    );

    if (!expressionResult.ok) {
      return expressionResult;
    }

    value += String(expressionResult.value ?? "");
    currentVariables = expressionResult.variables;
  }

  return createExpressionValue(value, currentVariables);
}

function evaluateCallExpression(
  expression: CallExpression | OptionalCallExpression,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  const methodCallResult = evaluateSafeMethodCallExpression(
    expression,
    variables,
  );

  if (methodCallResult) {
    return methodCallResult;
  }

  const calleeResult = resolveSafeCall(expression, variables);

  if (!calleeResult.ok) {
    return calleeResult;
  }

  if (calleeResult.optionalShortCircuited) {
    return createExpressionValue(undefined, calleeResult.variables);
  }

  const argumentResult = evaluateCallArguments(
    expression.arguments,
    calleeResult.variables,
  );

  if (!argumentResult.ok) {
    return argumentResult;
  }

  const callResult = calleeResult.callable(argumentResult.values);

  if (!callResult.ok) {
    return {
      ok: false,
      message: callResult.message,
    };
  }

  return createExpressionValue(callResult.value, argumentResult.variables);
}

type AssignmentTargetNode =
  | AssignmentExpression["left"]
  | UpdateExpression["argument"];

type AssignmentTarget =
  | {
      kind: "variable";
      name: string;
      value: ExecutionValue;
      variables: ExecutionVariables;
    }
  | {
      kind: "member";
      object: ExecutionArray | ExecutionObject;
      propertyKey: string | number;
      value: ExecutionValue;
    };

type SafeCallable = (
  args: ExecutionValue[],
) => { ok: true; value: ExecutionValue } | { ok: false; message: string };

type SafeStringMethod = (
  value: string,
  args: ExecutionValue[],
) => { ok: true; value: ExecutionValue } | { ok: false; message: string };

type SafeArrayMethod = (
  value: ExecutionArray,
  args: ExecutionValue[],
  callbackArgs: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  variables: ExecutionVariables,
) => ExpressionEvaluationResult;

type SafeArrayCallback = (
  values: ExecutionValue[],
) => ExpressionEvaluationResult;

type SupportValidationResult = { ok: true } | { ok: false; message: string };

type SafeCallResolution =
  | {
      ok: true;
      callable: SafeCallable;
      variables: ExecutionVariables;
      optionalShortCircuited?: boolean;
    }
  | {
      ok: false;
      message: string;
    };

const safeGlobalCalls: Record<string, SafeCallable> = {
  Number: (args) => createSafeCallValue(Number(args[0])),
  String: (args) => createSafeCallValue(String(args[0])),
  Boolean: (args) => createSafeCallValue(Boolean(args[0])),
  charAt: (args) => callStringIndexFunction("charAt", args, (value, index) =>
    value.charAt(index),
  ),
  charToCode: (args) => callCharToCode(args),
  codeToChar: (args) => callCodePointToString("codeToChar", args),
  charCodeAt: (args) =>
    callStringIndexFunction("charCodeAt", args, (value, index) =>
      value.charCodeAt(index),
    ),
  codePointAt: (args) =>
    callStringIndexFunction("codePointAt", args, (value, index) =>
      value.codePointAt(index),
    ),
  fromCharCode: (args) =>
    callCharacterCodeFunction("fromCharCode", args, String.fromCharCode),
  fromCodePoint: (args) =>
    callCodePointToString("fromCodePoint", args),
};

const safeMathCalls: Record<string, SafeCallable> = {
  abs: (args) => callNumberMathFunction("Math.abs", Math.abs, args),
  max: (args) => callVariadicNumberMathFunction("Math.max", Math.max, args),
  min: (args) => callVariadicNumberMathFunction("Math.min", Math.min, args),
  floor: (args) => callNumberMathFunction("Math.floor", Math.floor, args),
  ceil: (args) => callNumberMathFunction("Math.ceil", Math.ceil, args),
  round: (args) => callNumberMathFunction("Math.round", Math.round, args),
  trunc: (args) => callNumberMathFunction("Math.trunc", Math.trunc, args),
  random: (args) => callNoArgumentFunction("Math.random", args, Math.random),
  pow: (args) => callFixedNumberMathFunction("Math.pow", Math.pow, 2, args),
  sqrt: (args) => callNumberMathFunction("Math.sqrt", Math.sqrt, args),
  sin: (args) => callNumberMathFunction("Math.sin", Math.sin, args),
  cos: (args) => callNumberMathFunction("Math.cos", Math.cos, args),
  tan: (args) => callNumberMathFunction("Math.tan", Math.tan, args),
};

const safeObjectCalls: Record<string, SafeCallable> = {
  keys: (args) =>
    callObjectFunction("Object.keys", args, (value) => Object.keys(value)),
  values: (args) =>
    callObjectFunction("Object.values", args, (value) => Object.values(value)),
  entries: (args) =>
    callObjectFunction("Object.entries", args, (value) =>
      Object.entries(value).map(([key, item]) => [key, item]),
    ),
};

const safeStringMethods: Record<string, SafeStringMethod> = {
  toUpperCase: (value, args) =>
    callNoArgumentMethod("toUpperCase", args, () => value.toUpperCase()),
  toLowerCase: (value, args) =>
    callNoArgumentMethod("toLowerCase", args, () => value.toLowerCase()),
  trim: (value, args) =>
    callNoArgumentMethod("trim", args, () => value.trim()),
  includes: (value, args) =>
    callStringSearchMethod("includes", value, args, (search, position) =>
      value.includes(search, position),
    ),
  startsWith: (value, args) =>
    callStringSearchMethod("startsWith", value, args, (search, position) =>
      value.startsWith(search, position),
    ),
  endsWith: (value, args) =>
    callStringSearchMethod("endsWith", value, args, (search, position) =>
      value.endsWith(search, position),
    ),
  slice: (value, args) =>
    callStringSliceMethod("slice", value, args, (start, end) =>
      value.slice(start, end),
    ),
  substring: (value, args) =>
    callStringSliceMethod("substring", value, args, (start, end) =>
      value.substring(start ?? 0, end),
    ),
  replace: (value, args) => callStringReplaceMethod(value, args),
  split: (value, args) => callStringSplitMethod(value, args),
  charAt: (value, args) =>
    callStringOwnIndexMethod("charAt", value, args, (index) =>
      value.charAt(index),
    ),
  charCodeAt: (value, args) =>
    callStringOwnIndexMethod("charCodeAt", value, args, (index) =>
      value.charCodeAt(index),
    ),
  codePointAt: (value, args) =>
    callStringOwnIndexMethod("codePointAt", value, args, (index) =>
      value.codePointAt(index),
    ),
};

const safeArrayMethods: Record<string, SafeArrayMethod> = {
  push: (value, args) => createExpressionValue(value.push(...args), {}),
  pop: (value, args) =>
    callNoArgumentArrayMethod("pop", args, () => value.pop()),
  shift: (value, args) =>
    callNoArgumentArrayMethod("shift", args, () => value.shift()),
  unshift: (value, args) =>
    createExpressionValue(value.unshift(...args), {}),
  includes: (value, args) => callArrayIncludesMethod(value, args),
  indexOf: (value, args) => callArrayIndexOfMethod(value, args),
  slice: (value, args) => callArraySliceMethod(value, args),
  join: (value, args) => callArrayJoinMethod(value, args),
  map: (value, args, callbackArgs, variables) =>
    callArrayMapMethod(value, callbackArgs, variables),
  filter: (value, args, callbackArgs, variables) =>
    callArrayFilterMethod(value, callbackArgs, variables),
  find: (value, args, callbackArgs, variables) =>
    callArrayFindMethod(value, callbackArgs, variables),
  some: (value, args, callbackArgs, variables) =>
    callArraySomeMethod(value, callbackArgs, variables),
  every: (value, args, callbackArgs, variables) =>
    callArrayEveryMethod(value, callbackArgs, variables),
  reduce: (value, args, callbackArgs, variables) =>
    callArrayReduceMethod(value, args, callbackArgs, variables),
  sort: (value, args, callbackArgs, variables) =>
    callArraySortMethod(value, callbackArgs, variables),
};

export function validateExpressionSupport(
  expression: string,
): SupportValidationResult {
  const trimmedExpression = trimExpressionText(expression);

  if (!trimmedExpression) {
    return {
      ok: false,
      message: "La expresion esta vacia.",
    };
  }

  try {
    return validateExpressionNodeSupport(
      parseExpression(trimmedExpression, {
        sourceType: "unambiguous",
      }),
    );
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Expresion no soportada: ${error.message}`
          : "Expresion no soportada.",
    };
  }
}

export function validateProcessInstructionSupport(
  instruction: string,
): SupportValidationResult {
  const trimmedInstruction = trimExpressionText(instruction);
  const declarationMatch = trimmedInstruction.match(
    /^(let|const|var)\s+([A-Za-z_$][\w$]*)(?:\s*=\s*(.+))?$/,
  );

  if (!trimmedInstruction) {
    return {
      ok: false,
      message: "La instruccion de proceso esta vacia.",
    };
  }

  if (trimmedInstruction === "break" || trimmedInstruction === "continue") {
    return {
      ok: true,
    };
  }

  if (declarationMatch) {
    const [, , , initializer] = declarationMatch;

    return initializer ? validateExpressionSupport(initializer) : { ok: true };
  }

  try {
    const expression = parseExpression(trimmedInstruction, {
      sourceType: "unambiguous",
    });

    if (
      expression.type !== "AssignmentExpression" &&
      expression.type !== "UpdateExpression" &&
      expression.type !== "SequenceExpression" &&
      expression.type !== "CallExpression" &&
      expression.type !== "OptionalCallExpression"
    ) {
      return {
        ok: false,
        message:
          "El proceso debe ser una declaracion, asignacion, actualizacion o llamada segura.",
      };
    }

    return validateExpressionNodeSupport(expression);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Instruccion no soportada: ${error.message}`
          : "Instruccion no soportada.",
    };
  }
}

function validateExpressionNodeSupport(
  expression: Expression,
  options: { allowCallback?: boolean } = {},
): SupportValidationResult {
  if (
    expression.type === "Identifier" ||
    expression.type === "NumericLiteral" ||
    expression.type === "StringLiteral" ||
    expression.type === "BooleanLiteral" ||
    expression.type === "NullLiteral"
  ) {
    return { ok: true };
  }

  if (expression.type === "ParenthesizedExpression") {
    return validateExpressionNodeSupport(expression.expression, options);
  }

  if (expression.type === "UnaryExpression") {
    return validateExpressionNodeSupport(expression.argument, options);
  }

  if (
    expression.type === "LogicalExpression" ||
    expression.type === "BinaryExpression"
  ) {
    if (expression.left.type === "PrivateName") {
      return {
        ok: false,
        message: "Los campos privados no estan soportados.",
      };
    }

    return mergeValidationResults(
      validateExpressionNodeSupport(expression.left, options),
      validateExpressionNodeSupport(expression.right, options),
    );
  }

  if (expression.type === "ConditionalExpression") {
    return mergeValidationResults(
      validateExpressionNodeSupport(expression.test, options),
      validateExpressionNodeSupport(expression.consequent, options),
      validateExpressionNodeSupport(expression.alternate, options),
    );
  }

  if (
    expression.type === "MemberExpression" ||
    expression.type === "OptionalMemberExpression"
  ) {
    return validateMemberExpressionSupport(expression, options);
  }

  if (expression.type === "ArrayExpression") {
    return mergeValidationResults(
      ...expression.elements
        .filter((element): element is NonNullable<typeof element> =>
          Boolean(element),
        )
        .map((element) =>
          element.type === "SpreadElement"
            ? validateExpressionNodeSupport(element.argument, options)
            : validateExpressionNodeSupport(element, options),
        ),
    );
  }

  if (expression.type === "ObjectExpression") {
    const results = expression.properties.map((property) => {
      if (property.type === "SpreadElement") {
        return validateExpressionNodeSupport(property.argument, options);
      }

      if (property.type !== "ObjectProperty") {
        return {
          ok: false as const,
          message: `La propiedad de objeto "${property.type}" no esta soportada.`,
        };
      }

      return mergeValidationResults(
        property.computed
          ? validateExpressionNodeSupport(property.key as Expression, options)
          : { ok: true },
        validateExpressionNodeSupport(property.value as Expression, options),
      );
    });

    return mergeValidationResults(...results);
  }

  if (expression.type === "TemplateLiteral") {
    return mergeValidationResults(
      ...expression.expressions.map((item) =>
        validateExpressionNodeSupport(item as Expression, options),
      ),
    );
  }

  if (
    expression.type === "CallExpression" ||
    expression.type === "OptionalCallExpression"
  ) {
    return validateCallExpressionSupport(expression, options);
  }

  if (expression.type === "SequenceExpression") {
    return mergeValidationResults(
      ...expression.expressions.map((item) =>
        validateExpressionNodeSupport(item, options),
      ),
    );
  }

  if (expression.type === "AssignmentExpression") {
    return mergeValidationResults(
      validateAssignmentTargetSupport(expression.left, options),
      validateExpressionNodeSupport(expression.right, options),
    );
  }

  if (expression.type === "UpdateExpression") {
    return validateAssignmentTargetSupport(expression.argument, options);
  }

  if (
    expression.type === "ArrowFunctionExpression" ||
    expression.type === "FunctionExpression"
  ) {
    return options.allowCallback
      ? validateCallbackExpressionSupport(expression)
      : {
          ok: false,
          message:
            "Los callbacks solo estan soportados como argumento de metodos de arreglo.",
        };
  }

  return {
    ok: false,
    message: `La expresion "${expression.type}" todavia no esta soportada.`,
  };
}

function validateMemberExpressionSupport(
  expression: MemberExpression | OptionalMemberExpression,
  options: { allowCallback?: boolean },
): SupportValidationResult {
  if (expression.object.type === "Super") {
    return {
      ok: false as const,
      message: "super no esta soportado.",
    };
  }

  if (expression.property.type === "PrivateName") {
    return {
      ok: false as const,
      message: "Los campos privados no estan soportados.",
    };
  }

  return mergeValidationResults(
    validateExpressionNodeSupport(expression.object, options),
    expression.computed
      ? validateExpressionNodeSupport(expression.property, options)
      : { ok: true },
  );
}

function validateCallExpressionSupport(
  expression: CallExpression | OptionalCallExpression,
  options: { allowCallback?: boolean },
): SupportValidationResult {
  const callee = expression.callee;

  if (callee.type === "Identifier") {
    if (!(callee.name in safeGlobalCalls)) {
      return {
        ok: false as const,
        message: `La llamada "${callee.name}(...)" no esta permitida por seguridad.`,
      };
    }

    return validateCallArgumentsSupport(expression.arguments, options);
  }

  if (
    callee.type !== "MemberExpression" &&
    callee.type !== "OptionalMemberExpression"
  ) {
    return {
      ok: false as const,
      message: "Esta llamada no esta soportada.",
    };
  }

  const staticMember = getStaticMemberName(callee);
  const propertyName = staticMember?.propertyName;

  if (!propertyName) {
    return {
      ok: false as const,
      message: "Las llamadas con nombre calculado no estan soportadas.",
    };
  }

  if (staticMember.objectName === "Math") {
    return propertyName in safeMathCalls
      ? validateCallArgumentsSupport(expression.arguments, options)
      : {
          ok: false,
          message: `La llamada "Math.${propertyName}(...)" no esta permitida por seguridad.`,
        };
  }

  if (staticMember.objectName === "Object") {
    return propertyName in safeObjectCalls
      ? validateCallArgumentsSupport(expression.arguments, options)
      : {
          ok: false,
          message: `La llamada "Object.${propertyName}(...)" no esta permitida por seguridad.`,
        };
  }

  if (propertyName in safeArrayMethods) {
    return mergeValidationResults(
      validateMemberExpressionSupport(callee, options),
      validateArrayMethodArgumentsSupport(propertyName, expression.arguments),
    );
  }

  if (propertyName in safeStringMethods) {
    return mergeValidationResults(
      validateMemberExpressionSupport(callee, options),
      validateCallArgumentsSupport(expression.arguments, options),
    );
  }

  return {
    ok: false,
    message: `La llamada ".${propertyName}()" no esta permitida por seguridad.`,
  };
}

function validateArrayMethodArgumentsSupport(
  methodName: string,
  args: CallExpression["arguments"] | OptionalCallExpression["arguments"],
): SupportValidationResult {
  if (!isCallbackArrayMethod(methodName)) {
    return validateCallArgumentsSupport(args);
  }

  if (methodName === "sort" && args.length === 0) {
    return { ok: true };
  }

  if (methodName === "reduce") {
    return mergeValidationResults(
      validateSingleCallbackArgument(methodName, args[0]),
      args[1] ? validateCallArgumentSupport(args[1]) : { ok: true },
    );
  }

  return validateSingleCallbackArgument(methodName, args[0]);
}

function validateSingleCallbackArgument(
  methodName: string,
  argument: CallExpression["arguments"][number] | undefined,
): SupportValidationResult {
  if (!argument) {
    return {
      ok: false as const,
      message: `La llamada ".${methodName}()" necesita un callback.`,
    };
  }

  return validateCallArgumentSupport(argument, { allowCallback: true });
}

function validateCallArgumentsSupport(
  args: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  options: { allowCallback?: boolean } = {},
): SupportValidationResult {
  return mergeValidationResults(
    ...args.map((argument) => validateCallArgumentSupport(argument, options)),
  );
}

function validateCallArgumentSupport(
  argument: CallExpression["arguments"][number],
  options: { allowCallback?: boolean } = {},
): SupportValidationResult {
  if (argument.type === "ArgumentPlaceholder") {
    return {
      ok: false as const,
      message: "Los argumentos vacios no estan soportados.",
    };
  }

  if (argument.type === "SpreadElement") {
    return validateExpressionNodeSupport(argument.argument, options);
  }

  return validateExpressionNodeSupport(argument, options);
}

function validateAssignmentTargetSupport(
  target: AssignmentTargetNode,
  options: { allowCallback?: boolean },
): SupportValidationResult {
  if (target.type === "Identifier") {
    return { ok: true };
  }

  if (
    target.type === "MemberExpression" ||
    target.type === "OptionalMemberExpression"
  ) {
    return validateMemberExpressionSupport(target, options);
  }

  return {
    ok: false,
    message:
      "Solo se pueden asignar variables o propiedades como x = 5, obj.prop = 5 o arr[i] = 5.",
  };
}

function validateCallbackExpressionSupport(
  expression: ArrowFunctionExpression | FunctionExpression,
): SupportValidationResult {
  const parameterResult = getCallbackParameterNames(expression);

  if (!parameterResult.ok) {
    return parameterResult;
  }

  const bodyResult = getCallbackBodyExpression(expression);

  if (!bodyResult.ok) {
    return bodyResult;
  }

  return bodyResult.expression
    ? validateExpressionNodeSupport(bodyResult.expression)
    : { ok: true };
}

function mergeValidationResults(
  ...results: SupportValidationResult[]
): SupportValidationResult {
  return results.find((result) => !result.ok) ?? { ok: true };
}

function evaluateMemberAccess(
  expression: MemberExpression | OptionalMemberExpression,
  variables: ExecutionVariables,
):
  | { ok: true; value: ExecutionValue; variables: ExecutionVariables }
  | { ok: false; message: string } {
  if (expression.object.type === "Super") {
    return {
      ok: false,
      message: "super no esta soportado en accesos a propiedades.",
    };
  }

  const staticMember = getStaticMemberName(expression);

  if (
    staticMember?.objectName === "Math" &&
    staticMember.propertyName === "PI"
  ) {
    return createExpressionValue(Math.PI, variables);
  }

  const objectResult = evaluateExpressionNode(expression.object, variables);

  if (!objectResult.ok) {
    return objectResult;
  }

  if (objectResult.value === null || objectResult.value === undefined) {
    if (isOptionalMemberAccess(expression)) {
      return createExpressionValue(undefined, objectResult.variables);
    }

    return {
      ok: false,
      message: "No se puede leer una propiedad de null o undefined.",
    };
  }

  const propertyResult = getMemberPropertyKey(
    expression,
    objectResult.variables,
  );

  if (!propertyResult.ok) {
    return propertyResult;
  }

  const valueResult = getMemberValue(objectResult.value, propertyResult.key);

  if (!valueResult.ok) {
    return valueResult;
  }

  return createExpressionValue(valueResult.value, propertyResult.variables);
}

function getMemberPropertyKey(
  expression: MemberExpression | OptionalMemberExpression,
  variables: ExecutionVariables,
):
  | { ok: true; key: string | number; variables: ExecutionVariables }
  | { ok: false; message: string } {
  if (expression.property.type === "PrivateName") {
    return {
      ok: false,
      message: "Los campos privados no estan soportados.",
    };
  }

  if (!expression.computed && expression.property.type === "Identifier") {
    return {
      ok: true,
      key: expression.property.name,
      variables,
    };
  }

  const propertyResult = evaluateExpressionNode(expression.property, variables);

  if (!propertyResult.ok) {
    return propertyResult;
  }

  const keyResult = toPropertyKey(propertyResult.value);

  if (!keyResult.ok) {
    return keyResult;
  }

  return {
    ok: true,
    key: keyResult.key,
    variables: propertyResult.variables,
  };
}

function getObjectPropertyKey(
  property: ObjectProperty,
  variables: ExecutionVariables,
):
  | { ok: true; key: string; variables: ExecutionVariables }
  | { ok: false; message: string } {
  if (!property.computed) {
    if (property.key.type === "Identifier") {
      return {
        ok: true,
        key: property.key.name,
        variables,
      };
    }

    if (
      property.key.type === "StringLiteral" ||
      property.key.type === "NumericLiteral" ||
      property.key.type === "BooleanLiteral"
    ) {
      return {
        ok: true,
        key: String(property.key.value),
        variables,
      };
    }
  }

  if (property.key.type === "PrivateName") {
    return {
      ok: false,
      message: "Los campos privados no estan soportados en objetos.",
    };
  }

  const keyResult = evaluateExpressionNode(property.key, variables);

  if (!keyResult.ok) {
    return keyResult;
  }

  const propertyKeyResult = toPropertyKey(keyResult.value);

  if (!propertyKeyResult.ok) {
    return propertyKeyResult;
  }

  return {
    ok: true,
    key: String(propertyKeyResult.key),
    variables: keyResult.variables,
  };
}

function getMemberValue(
  value: ExecutionValue,
  propertyKey: string | number,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  if (Array.isArray(value)) {
    if (propertyKey === "length") {
      return {
        ok: true,
        value: value.length,
      };
    }

    const index = toArrayIndex(propertyKey);

    if (index === null) {
      return {
        ok: true,
        value: undefined,
      };
    }

    return {
      ok: true,
      value: value[index],
    };
  }

  if (typeof value === "string") {
    if (propertyKey === "length") {
      return {
        ok: true,
        value: value.length,
      };
    }

    const index = toArrayIndex(propertyKey);

    if (index === null) {
      return {
        ok: true,
        value: undefined,
      };
    }

    return {
      ok: true,
      value: value[index],
    };
  }

  if (isPlainExecutionObject(value)) {
    return {
      ok: true,
      value: value[String(propertyKey)],
    };
  }

  return {
    ok: false,
    message: "Solo se pueden leer propiedades de arreglos, textos u objetos.",
  };
}

function resolveSafeCall(
  expression: CallExpression | OptionalCallExpression,
  variables: ExecutionVariables,
): SafeCallResolution {
  const callee = expression.callee;

  if (callee.type === "Identifier") {
    const callable = safeGlobalCalls[callee.name];

    if (!callable) {
      return {
        ok: false,
        message: `La llamada "${callee.name}(...)" no esta permitida por seguridad.`,
      };
    }

    return {
      ok: true,
      callable,
      variables,
    };
  }

  if (callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression") {
    const staticMember = getStaticMemberName(callee);

    if (staticMember?.objectName === "Math") {
      const callable = safeMathCalls[staticMember.propertyName];

      if (!callable) {
        return {
          ok: false,
          message: `La llamada "Math.${staticMember.propertyName}(...)" no esta permitida por seguridad.`,
        };
      }

      return {
        ok: true,
        callable,
        variables,
      };
    }

    if (staticMember?.objectName === "Object") {
      const callable = safeObjectCalls[staticMember.propertyName];

      if (!callable) {
        return {
          ok: false,
          message: `La llamada "Object.${staticMember.propertyName}(...)" no esta permitida por seguridad.`,
        };
      }

      return {
        ok: true,
        callable,
        variables,
      };
    }
  }

  if (callee.type === "Super" || callee.type === "V8IntrinsicIdentifier") {
    return {
      ok: false,
      message: "Esta llamada no esta soportada.",
    };
  }

  return {
    ok: false,
    message:
      "Llamada no permitida. Usa solo Number, String, Boolean, conversiones de caracteres, Math.*, Object.* o metodos seguros de texto y arreglos.",
  };
}

function evaluateSafeMethodCallExpression(
  expression: CallExpression | OptionalCallExpression,
  variables: ExecutionVariables,
): ExpressionEvaluationResult | null {
  const callee = expression.callee;

  if (
    callee.type !== "MemberExpression" &&
    callee.type !== "OptionalMemberExpression"
  ) {
    return null;
  }

  const staticMember = getStaticMemberName(callee);
  const methodName = staticMember?.propertyName;

  if (
    !methodName ||
    (!(methodName in safeStringMethods) && !(methodName in safeArrayMethods))
  ) {
    return null;
  }

  if (callee.object.type === "Super") {
    return {
      ok: false,
      message: "super no esta soportado en llamadas.",
    };
  }

  const shouldCloneVariables =
    methodName in safeArrayMethods && isMutatingArrayMethod(methodName);
  const objectResult = evaluateExpressionNode(
    callee.object,
    shouldCloneVariables ? cloneExecutionVariables(variables) : variables,
  );

  if (!objectResult.ok) {
    return objectResult;
  }

  if (objectResult.value === null || objectResult.value === undefined) {
    if (isOptionalMemberAccess(callee) || expression.type === "OptionalCallExpression") {
      return createExpressionValue(undefined, objectResult.variables);
    }

    return {
      ok: false,
      message: `No se puede llamar ".${methodName}()" sobre null o undefined.`,
    };
  }

  if (typeof objectResult.value === "string" && methodName in safeStringMethods) {
    const argumentResult = evaluateCallArguments(
      expression.arguments,
      objectResult.variables,
    );

    if (!argumentResult.ok) {
      return argumentResult;
    }

    const callResult = safeStringMethods[methodName](
      objectResult.value,
      argumentResult.values,
    );

    if (!callResult.ok) {
      return callResult;
    }

    return createExpressionValue(callResult.value, argumentResult.variables);
  }

  if (Array.isArray(objectResult.value) && methodName in safeArrayMethods) {
    return evaluateSafeArrayMethodCall({
      arrayValue: objectResult.value,
      callee,
      expression,
      methodName,
      variables: objectResult.variables,
    });
  }

  if (methodName in safeStringMethods) {
    return {
      ok: false,
      message: `La llamada ".${methodName}()" solo esta permitida para textos.`,
    };
  }

  return {
    ok: false,
    message: `La llamada ".${methodName}()" solo esta permitida para arreglos.`,
  };
}

function evaluateSafeArrayMethodCall({
  arrayValue,
  callee,
  expression,
  methodName,
  variables,
}: {
  arrayValue: ExecutionArray;
  callee: MemberExpression | OptionalMemberExpression;
  expression: CallExpression | OptionalCallExpression;
  methodName: string;
  variables: ExecutionVariables;
}): ExpressionEvaluationResult {
  const method = safeArrayMethods[methodName];

  if (isCallbackArrayMethod(methodName)) {
    const methodResult = method(arrayValue, [], expression.arguments, variables);

    if (!methodResult.ok) {
      return methodResult;
    }

    return createExpressionValue(methodResult.value, variables);
  }

  const argumentResult = evaluateCallArguments(expression.arguments, variables);

  if (!argumentResult.ok) {
    return argumentResult;
  }

  let targetArray = arrayValue;
  let targetVariables = argumentResult.variables;

  if (isMutatingArrayMethod(methodName)) {
    const latestObjectResult = evaluateExpressionNode(
      callee.object as Expression,
      argumentResult.variables,
    );

    if (!latestObjectResult.ok) {
      return latestObjectResult;
    }

    if (!Array.isArray(latestObjectResult.value)) {
      return {
        ok: false,
        message: `La llamada ".${methodName}()" solo esta permitida para arreglos.`,
      };
    }

    targetArray = latestObjectResult.value;
    targetVariables = latestObjectResult.variables;
  }

  const methodResult = method(
    targetArray,
    argumentResult.values,
    expression.arguments,
    targetVariables,
  );

  if (!methodResult.ok) {
    return methodResult;
  }

  return createExpressionValue(methodResult.value, targetVariables);
}

function isCallbackArrayMethod(methodName: string) {
  return (
    methodName === "map" ||
    methodName === "filter" ||
    methodName === "find" ||
    methodName === "some" ||
    methodName === "every" ||
    methodName === "reduce" ||
    methodName === "sort"
  );
}

function isMutatingArrayMethod(methodName: string) {
  return (
    methodName === "push" ||
    methodName === "pop" ||
    methodName === "shift" ||
    methodName === "unshift" ||
    methodName === "sort"
  );
}

function evaluateCallArguments(
  args: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  variables: ExecutionVariables,
):
  | { ok: true; values: ExecutionValue[]; variables: ExecutionVariables }
  | { ok: false; message: string } {
  const values: ExecutionValue[] = [];
  let currentVariables = variables;

  for (const argument of args) {
    if (argument.type === "ArgumentPlaceholder") {
      return {
        ok: false,
        message: "Los argumentos vacios no estan soportados.",
      };
    }

    if (argument.type === "SpreadElement") {
      const spreadResult = evaluateExpressionNode(
        argument.argument,
        currentVariables,
      );

      if (!spreadResult.ok) {
        return spreadResult;
      }

      if (!Array.isArray(spreadResult.value)) {
        return {
          ok: false,
          message: "El spread en llamadas solo soporta arreglos.",
        };
      }

      values.push(...spreadResult.value);
      currentVariables = spreadResult.variables;
      continue;
    }

    const argumentResult = evaluateExpressionNode(argument, currentVariables);

    if (!argumentResult.ok) {
      return argumentResult;
    }

    values.push(argumentResult.value);
    currentVariables = argumentResult.variables;
  }

  return {
    ok: true,
    values,
    variables: currentVariables,
  };
}

function isSupportedAssignmentTarget(
  target: AssignmentTargetNode,
): target is AssignmentTargetNode & {
  type: "Identifier" | "MemberExpression" | "OptionalMemberExpression";
} {
  return (
    target.type === "Identifier" ||
    target.type === "MemberExpression" ||
    target.type === "OptionalMemberExpression"
  );
}

function resolveAssignmentTarget(
  target: AssignmentTargetNode,
  variables: ExecutionVariables,
):
  | { ok: true; target: AssignmentTarget }
  | { ok: false; message: string } {
  if (target.type === "Identifier") {
    return {
      ok: true,
      target: {
        kind: "variable",
        name: target.name,
        value: variables[target.name],
        variables,
      },
    };
  }

  if (target.type !== "MemberExpression" && target.type !== "OptionalMemberExpression") {
    return {
      ok: false,
      message: "El destino de asignacion no esta soportado.",
    };
  }

  if (target.object.type === "Super") {
    return {
      ok: false,
      message: "super no esta soportado como destino de asignacion.",
    };
  }

  const objectResult = evaluateExpressionNode(target.object, variables);

  if (!objectResult.ok) {
    return objectResult;
  }

  if (objectResult.value === null || objectResult.value === undefined) {
    return {
      ok: false,
      message: "No se puede asignar una propiedad de null o undefined.",
    };
  }

  if (!Array.isArray(objectResult.value) && !isPlainExecutionObject(objectResult.value)) {
    return {
      ok: false,
      message: "Solo se pueden asignar propiedades de arreglos u objetos planos.",
    };
  }

  const propertyResult = getMemberPropertyKey(target, objectResult.variables);

  if (!propertyResult.ok) {
    return propertyResult;
  }

  if (Array.isArray(objectResult.value)) {
    const index = toArrayIndex(propertyResult.key);

    if (index === null) {
      return {
        ok: false,
        message: "Los arreglos solo soportan asignacion por indice numerico.",
      };
    }

    return {
      ok: true,
      target: {
        kind: "member",
        object: objectResult.value,
        propertyKey: index,
        value: objectResult.value[index],
      },
    };
  }

  const propertyKey = String(propertyResult.key);

  return {
    ok: true,
    target: {
      kind: "member",
      object: objectResult.value,
      propertyKey,
      value: objectResult.value[propertyKey],
    },
  };
}

function setAssignmentTargetValue(
  target: AssignmentTarget,
  value: ExecutionValue,
) {
  if (target.kind === "variable") {
    target.variables[target.name] = value;
    return;
  }

  if (Array.isArray(target.object)) {
    target.object[target.propertyKey as number] = value;
    return;
  }

  target.object[String(target.propertyKey)] = value;
}

function cloneExecutionVariables(variables: ExecutionVariables) {
  return Object.fromEntries(
    Object.entries(variables).map(([name, value]) => [
      name,
      cloneExecutionValue(value),
    ]),
  ) as ExecutionVariables;
}

function cloneExecutionValue(value: ExecutionValue): ExecutionValue {
  if (Array.isArray(value)) {
    return value.map(cloneExecutionValue);
  }

  if (isPlainExecutionObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneExecutionValue(item)]),
    );
  }

  return value;
}

function formatExecutionValue(value: ExecutionValue) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (value === undefined) {
    return "undefined";
  }

  if (Array.isArray(value) || isPlainExecutionObject(value)) {
    return JSON.stringify(value);
  }

  return String(value);
}

function getStaticMemberName(
  expression: MemberExpression | OptionalMemberExpression,
) {
  if (expression.computed || expression.property.type !== "Identifier") {
    return null;
  }

  if (expression.object.type !== "Identifier") {
    return {
      objectName: "",
      propertyName: expression.property.name,
    };
  }

  return {
    objectName: expression.object.name,
    propertyName: expression.property.name,
  };
}

function isOptionalMemberAccess(
  expression: MemberExpression | OptionalMemberExpression,
) {
  return expression.type === "OptionalMemberExpression" && expression.optional;
}

function toPropertyKey(
  value: ExecutionValue,
): { ok: true; key: string | number } | { ok: false; message: string } {
  if (typeof value === "string" || typeof value === "number") {
    return {
      ok: true,
      key: value,
    };
  }

  if (
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return {
      ok: true,
      key: String(value),
    };
  }

  return {
    ok: false,
    message: "La propiedad calculada debe ser numero, texto, booleano, null o undefined.",
  };
}

function toArrayIndex(propertyKey: string | number) {
  if (typeof propertyKey === "number") {
    return Number.isInteger(propertyKey) && propertyKey >= 0 ? propertyKey : null;
  }

  if (!/^(0|[1-9]\d*)$/.test(propertyKey)) {
    return null;
  }

  return Number(propertyKey);
}

function isPlainExecutionObject(
  value: ExecutionValue,
): value is ExecutionObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createSafeCallValue(value: ExecutionValue) {
  return {
    ok: true,
    value,
  } as const;
}

function callNoArgumentFunction(
  name: string,
  args: ExecutionValue[],
  fn: () => ExecutionValue,
) {
  if (args.length !== 0) {
    return {
      ok: false,
      message: `${name} no recibe argumentos.`,
    } as const;
  }

  return createSafeCallValue(fn());
}

function callNoArgumentMethod(
  name: string,
  args: ExecutionValue[],
  fn: () => ExecutionValue,
) {
  if (args.length !== 0) {
    return {
      ok: false,
      message: `La llamada ".${name}()" no recibe argumentos.`,
    } as const;
  }

  return createSafeCallValue(fn());
}

function callNoArgumentArrayMethod(
  name: string,
  args: ExecutionValue[],
  fn: () => ExecutionValue,
) {
  if (args.length !== 0) {
    return createExpressionError(`La llamada ".${name}()" no recibe argumentos.`);
  }

  return createExpressionValue(fn(), {});
}

function callStringSearchMethod(
  name: string,
  value: string,
  args: ExecutionValue[],
  fn: (search: string, position?: number) => boolean,
) {
  if (args.length < 1 || args.length > 2) {
    return {
      ok: false,
      message: `La llamada ".${name}()" espera 1 o 2 argumento(s).`,
    } as const;
  }

  if (typeof args[0] !== "string") {
    return {
      ok: false,
      message: `La llamada ".${name}()" espera texto como busqueda.`,
    } as const;
  }

  const positionResult = getOptionalNumberArgument(
    `.${name}()`,
    args,
    1,
    "posicion",
  );

  if (!positionResult.ok) {
    return positionResult;
  }

  return createSafeCallValue(fn(args[0], positionResult.value));
}

function callStringSliceMethod(
  name: string,
  value: string,
  args: ExecutionValue[],
  fn: (start?: number, end?: number) => string,
) {
  if (args.length > 2) {
    return {
      ok: false,
      message: `La llamada ".${name}()" espera maximo 2 argumento(s).`,
    } as const;
  }

  const startResult = getOptionalNumberArgument(
    `.${name}()`,
    args,
    0,
    "inicio",
  );

  if (!startResult.ok) {
    return startResult;
  }

  const endResult = getOptionalNumberArgument(`.${name}()`, args, 1, "fin");

  if (!endResult.ok) {
    return endResult;
  }

  return createSafeCallValue(fn(startResult.value, endResult.value));
}

function callStringReplaceMethod(value: string, args: ExecutionValue[]) {
  if (args.length !== 2) {
    return {
      ok: false,
      message: 'La llamada ".replace()" espera exactamente 2 argumento(s).',
    } as const;
  }

  if (typeof args[0] !== "string" || typeof args[1] !== "string") {
    return {
      ok: false,
      message: 'La llamada ".replace()" espera textos como busqueda y reemplazo.',
    } as const;
  }

  return createSafeCallValue(value.replace(args[0], args[1]));
}

function callStringSplitMethod(value: string, args: ExecutionValue[]) {
  if (args.length > 2) {
    return {
      ok: false,
      message: 'La llamada ".split()" espera maximo 2 argumento(s).',
    } as const;
  }

  if (args.length === 0 || args[0] === undefined) {
    return createSafeCallValue([value]);
  }

  if (typeof args[0] !== "string") {
    return {
      ok: false,
      message: 'La llamada ".split()" espera un separador de texto.',
    } as const;
  }

  const limitResult = getOptionalNumberArgument(".split()", args, 1, "limite");

  if (!limitResult.ok) {
    return limitResult;
  }

  return createSafeCallValue(value.split(args[0], limitResult.value));
}

function callStringOwnIndexMethod(
  name: string,
  value: string,
  args: ExecutionValue[],
  fn: (index: number) => ExecutionValue,
) {
  if (args.length !== 1) {
    return {
      ok: false,
      message: `La llamada ".${name}()" espera exactamente 1 argumento(s).`,
    } as const;
  }

  if (typeof args[0] !== "number") {
    return {
      ok: false,
      message: `La llamada ".${name}()" espera un indice numerico.`,
    } as const;
  }

  return createSafeCallValue(fn(args[0]));
}

function callStringIndexFunction(
  name: string,
  args: ExecutionValue[],
  fn: (value: string, index: number) => ExecutionValue,
) {
  if (args.length !== 2) {
    return {
      ok: false,
      message: `${name} espera exactamente 2 argumento(s): texto e indice.`,
    } as const;
  }

  if (typeof args[0] !== "string") {
    return {
      ok: false,
      message: `${name} espera texto como primer argumento.`,
    } as const;
  }

  if (typeof args[1] !== "number") {
    return {
      ok: false,
      message: `${name} espera un indice numerico como segundo argumento.`,
    } as const;
  }

  return createSafeCallValue(fn(args[0], args[1]));
}

function callCharToCode(args: ExecutionValue[]) {
  if (args.length !== 1) {
    return {
      ok: false,
      message: "charToCode espera exactamente 1 caracter.",
    } as const;
  }

  const characterResult = getSingleCharacterArgument("charToCode", args[0]);

  if (!characterResult.ok) {
    return characterResult;
  }

  return createSafeCallValue(characterResult.value.codePointAt(0));
}

function callCharacterCodeFunction(
  name: string,
  args: ExecutionValue[],
  fn: (code: number) => string,
) {
  if (args.length !== 1) {
    return {
      ok: false,
      message: `${name} espera exactamente 1 codigo numerico.`,
    } as const;
  }

  const codeResult = getFiniteNumberArgument(name, args[0], "codigo");

  if (!codeResult.ok) {
    return codeResult;
  }

  return createSafeCallValue(fn(codeResult.value));
}

function callCodePointToString(name: string, args: ExecutionValue[]) {
  if (args.length !== 1) {
    return {
      ok: false,
      message: `${name} espera exactamente 1 codigo numerico.`,
    } as const;
  }

  const codeResult = getCodePointArgument(name, args[0]);

  if (!codeResult.ok) {
    return codeResult;
  }

  return createSafeCallValue(String.fromCodePoint(codeResult.value));
}

function callObjectFunction(
  name: string,
  args: ExecutionValue[],
  fn: (value: ExecutionArray | ExecutionObject) => ExecutionValue,
) {
  if (args.length !== 1) {
    return {
      ok: false,
      message: `${name} espera exactamente 1 objeto.`,
    } as const;
  }

  if (!Array.isArray(args[0]) && !isPlainExecutionObject(args[0])) {
    return {
      ok: false,
      message: `${name} solo soporta objetos planos o arreglos.`,
    } as const;
  }

  return createSafeCallValue(fn(args[0]));
}

function callNumberMathFunction(
  name: string,
  fn: (value: number) => number,
  args: ExecutionValue[],
) {
  if (args.length !== 1) {
    return {
      ok: false,
      message: `${name} espera exactamente 1 argumento(s).`,
    } as const;
  }

  if (typeof args[0] !== "number") {
    return {
      ok: false,
      message: `${name} solo soporta argumentos numericos.`,
    } as const;
  }

  return createSafeCallValue(fn(args[0]));
}

function callFixedNumberMathFunction(
  name: string,
  fn: (...values: number[]) => number,
  expectedCount: number,
  args: ExecutionValue[],
) {
  if (args.length !== expectedCount) {
    return {
      ok: false,
      message: `${name} espera exactamente ${expectedCount} argumento(s).`,
    } as const;
  }

  if (!args.every((arg) => typeof arg === "number")) {
    return {
      ok: false,
      message: `${name} solo soporta argumentos numericos.`,
    } as const;
  }

  return createSafeCallValue(fn(...(args as number[])));
}

function callVariadicNumberMathFunction(
  name: string,
  fn: (...values: number[]) => number,
  args: ExecutionValue[],
) {
  if (args.length === 0) {
    return {
      ok: false,
      message: `${name} espera al menos 1 argumento.`,
    } as const;
  }

  if (!args.every((arg) => typeof arg === "number")) {
    return {
      ok: false,
      message: `${name} solo soporta argumentos numericos.`,
    } as const;
  }

  return createSafeCallValue(fn(...(args as number[])));
}

function callArrayIncludesMethod(value: ExecutionArray, args: ExecutionValue[]) {
  if (args.length < 1 || args.length > 2) {
    return createExpressionError(
      'La llamada ".includes()" espera 1 o 2 argumento(s).',
    );
  }

  const fromIndexResult = getOptionalNumberArgument(
    ".includes()",
    args,
    1,
    "inicio",
  );

  if (!fromIndexResult.ok) {
    return createExpressionError(fromIndexResult.message);
  }

  return createExpressionValue(
    value.includes(args[0], fromIndexResult.value),
    {},
  );
}

function callArrayIndexOfMethod(value: ExecutionArray, args: ExecutionValue[]) {
  if (args.length < 1 || args.length > 2) {
    return createExpressionError(
      'La llamada ".indexOf()" espera 1 o 2 argumento(s).',
    );
  }

  const fromIndexResult = getOptionalNumberArgument(
    ".indexOf()",
    args,
    1,
    "inicio",
  );

  if (!fromIndexResult.ok) {
    return createExpressionError(fromIndexResult.message);
  }

  return createExpressionValue(
    value.indexOf(args[0], fromIndexResult.value),
    {},
  );
}

function callArraySliceMethod(value: ExecutionArray, args: ExecutionValue[]) {
  if (args.length > 2) {
    return createExpressionError(
      'La llamada ".slice()" espera maximo 2 argumento(s).',
    );
  }

  const startResult = getOptionalNumberArgument(
    ".slice()",
    args,
    0,
    "inicio",
  );

  if (!startResult.ok) {
    return createExpressionError(startResult.message);
  }

  const endResult = getOptionalNumberArgument(".slice()", args, 1, "fin");

  if (!endResult.ok) {
    return createExpressionError(endResult.message);
  }

  return createExpressionValue(value.slice(startResult.value, endResult.value), {});
}

function callArrayJoinMethod(value: ExecutionArray, args: ExecutionValue[]) {
  if (args.length > 1) {
    return createExpressionError(
      'La llamada ".join()" espera maximo 1 argumento.',
    );
  }

  if (args.length === 1 && typeof args[0] !== "string") {
    return createExpressionError(
      'La llamada ".join()" espera un separador de texto.',
    );
  }

  const separator = args.length === 1 ? (args[0] as string) : ",";

  return createExpressionValue(value.join(separator), {});
}

function callArrayMapMethod(
  value: ExecutionArray,
  callbackArgs: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  variables: ExecutionVariables,
) {
  const callbackResult = createSafeArrayCallback(".map()", callbackArgs, variables);

  if (!callbackResult.ok) {
    return callbackResult;
  }

  const mappedValues: ExecutionValue[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const itemResult = callbackResult.callback([value[index], index, value]);

    if (!itemResult.ok) {
      return itemResult;
    }

    mappedValues.push(itemResult.value);
  }

  return createExpressionValue(mappedValues, {});
}

function callArrayFilterMethod(
  value: ExecutionArray,
  callbackArgs: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  variables: ExecutionVariables,
) {
  const callbackResult = createSafeArrayCallback(
    ".filter()",
    callbackArgs,
    variables,
  );

  if (!callbackResult.ok) {
    return callbackResult;
  }

  const filteredValues: ExecutionValue[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const itemResult = callbackResult.callback([value[index], index, value]);

    if (!itemResult.ok) {
      return itemResult;
    }

    if (itemResult.value) {
      filteredValues.push(value[index]);
    }
  }

  return createExpressionValue(filteredValues, {});
}

function callArrayFindMethod(
  value: ExecutionArray,
  callbackArgs: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  variables: ExecutionVariables,
) {
  const callbackResult = createSafeArrayCallback(".find()", callbackArgs, variables);

  if (!callbackResult.ok) {
    return callbackResult;
  }

  for (let index = 0; index < value.length; index += 1) {
    const itemResult = callbackResult.callback([value[index], index, value]);

    if (!itemResult.ok) {
      return itemResult;
    }

    if (itemResult.value) {
      return createExpressionValue(value[index], {});
    }
  }

  return createExpressionValue(undefined, {});
}

function callArraySomeMethod(
  value: ExecutionArray,
  callbackArgs: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  variables: ExecutionVariables,
) {
  const callbackResult = createSafeArrayCallback(".some()", callbackArgs, variables);

  if (!callbackResult.ok) {
    return callbackResult;
  }

  for (let index = 0; index < value.length; index += 1) {
    const itemResult = callbackResult.callback([value[index], index, value]);

    if (!itemResult.ok) {
      return itemResult;
    }

    if (itemResult.value) {
      return createExpressionValue(true, {});
    }
  }

  return createExpressionValue(false, {});
}

function callArrayEveryMethod(
  value: ExecutionArray,
  callbackArgs: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  variables: ExecutionVariables,
) {
  const callbackResult = createSafeArrayCallback(
    ".every()",
    callbackArgs,
    variables,
  );

  if (!callbackResult.ok) {
    return callbackResult;
  }

  for (let index = 0; index < value.length; index += 1) {
    const itemResult = callbackResult.callback([value[index], index, value]);

    if (!itemResult.ok) {
      return itemResult;
    }

    if (!itemResult.value) {
      return createExpressionValue(false, {});
    }
  }

  return createExpressionValue(true, {});
}

function callArrayReduceMethod(
  value: ExecutionArray,
  _args: ExecutionValue[],
  callbackArgs: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  variables: ExecutionVariables,
) {
  if (callbackArgs.length < 1 || callbackArgs.length > 2) {
    return createExpressionError(
      'La llamada ".reduce()" espera callback y, opcionalmente, valor inicial.',
    );
  }

  const callbackResult = createSafeArrayCallback(
    ".reduce()",
    [callbackArgs[0]],
    variables,
  );

  if (!callbackResult.ok) {
    return callbackResult;
  }

  let accumulator: ExecutionValue;
  let startIndex: number;

  if (callbackArgs.length === 2) {
    const initialValue = callbackArgs[1];

    if (
      initialValue.type === "ArgumentPlaceholder" ||
      initialValue.type === "SpreadElement"
    ) {
      return createExpressionError(
        'El valor inicial de ".reduce()" debe ser una expresion simple.',
      );
    }

    const initialResult = evaluateExpressionNode(initialValue, variables);

    if (!initialResult.ok) {
      return initialResult;
    }

    accumulator = initialResult.value;
    startIndex = 0;
  } else {
    if (value.length === 0) {
      return createExpressionError(
        'La llamada ".reduce()" sobre un arreglo vacio necesita valor inicial.',
      );
    }

    accumulator = value[0];
    startIndex = 1;
  }

  for (let index = startIndex; index < value.length; index += 1) {
    const itemResult = callbackResult.callback([
      accumulator,
      value[index],
      index,
      value,
    ]);

    if (!itemResult.ok) {
      return itemResult;
    }

    accumulator = itemResult.value;
  }

  return createExpressionValue(accumulator, {});
}

function callArraySortMethod(
  value: ExecutionArray,
  callbackArgs: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  variables: ExecutionVariables,
) {
  if (callbackArgs.length > 1) {
    return createExpressionError(
      'La llamada ".sort()" espera maximo 1 callback de comparacion.',
    );
  }

  if (callbackArgs.length === 0) {
    value.sort((left, right) => String(left).localeCompare(String(right)));

    return createExpressionValue(value, {});
  }

  const callbackResult = createSafeArrayCallback(".sort()", callbackArgs, variables);

  if (!callbackResult.ok) {
    return callbackResult;
  }

  try {
    value.sort((left, right) => {
      const itemResult = callbackResult.callback([left, right]);

      if (!itemResult.ok) {
        throw new SafeSortCallbackError(itemResult.message);
      }

      if (typeof itemResult.value !== "number") {
        throw new SafeSortCallbackError(
          'El callback de ".sort()" debe retornar un numero.',
        );
      }

      return itemResult.value;
    });
  } catch (error) {
    if (error instanceof SafeSortCallbackError) {
      return createExpressionError(error.message);
    }

    throw error;
  }

  return createExpressionValue(value, {});
}

function createSafeArrayCallback(
  methodName: string,
  args: CallExpression["arguments"] | OptionalCallExpression["arguments"],
  variables: ExecutionVariables,
):
  | { ok: true; callback: SafeArrayCallback }
  | { ok: false; message: string } {
  if (args.length !== 1) {
    return {
      ok: false,
      message: `La llamada "${methodName}" espera exactamente 1 callback.`,
    };
  }

  const callbackExpression = args[0];

  if (
    callbackExpression.type !== "ArrowFunctionExpression" &&
    callbackExpression.type !== "FunctionExpression"
  ) {
    return {
      ok: false,
      message: `La llamada "${methodName}" necesita un callback como x => x.`,
    };
  }

  const parameterResult = getCallbackParameterNames(callbackExpression);

  if (!parameterResult.ok) {
    return parameterResult;
  }

  const bodyResult = getCallbackBodyExpression(callbackExpression);

  if (!bodyResult.ok) {
    return bodyResult;
  }

  return {
    ok: true,
    callback: (values) => {
      const callbackVariables = cloneExecutionVariables(variables);

      parameterResult.names.forEach((name, index) => {
        callbackVariables[name] = values[index];
      });

      if (!bodyResult.expression) {
        return createExpressionValue(undefined, callbackVariables);
      }

      return evaluateExpressionNode(bodyResult.expression, callbackVariables);
    },
  };
}

function getCallbackParameterNames(
  callbackExpression: ArrowFunctionExpression | FunctionExpression,
): { ok: true; names: string[] } | { ok: false; message: string } {
  const names: string[] = [];

  for (const parameter of callbackExpression.params) {
    if (parameter.type !== "Identifier") {
      return {
        ok: false,
        message:
          "Los callbacks de arreglos solo soportan parametros simples, como x o (x, i).",
      };
    }

    names.push(parameter.name);
  }

  return {
    ok: true,
    names,
  };
}

function getCallbackBodyExpression(
  callbackExpression: ArrowFunctionExpression | FunctionExpression,
): { ok: true; expression?: Expression } | { ok: false; message: string } {
  if (callbackExpression.body.type !== "BlockStatement") {
    return {
      ok: true,
      expression: callbackExpression.body as Expression,
    };
  }

  if (callbackExpression.body.body.length === 0) {
    return {
      ok: true,
      expression: undefined,
    };
  }

  if (
    callbackExpression.body.body.length === 1 &&
    callbackExpression.body.body[0].type === "ReturnStatement"
  ) {
    return {
      ok: true,
      expression: callbackExpression.body.body[0].argument as
        | Expression
        | undefined,
    };
  }

  return {
    ok: false,
    message:
      "Los callbacks con bloque solo soportan una instruccion return simple.",
  };
}

class SafeSortCallbackError extends Error {}

function getOptionalNumberArgument(
  context: string,
  args: ExecutionValue[],
  index: number,
  label: string,
): { ok: true; value?: number } | { ok: false; message: string } {
  if (args[index] === undefined) {
    return {
      ok: true,
      value: undefined,
    };
  }

  if (typeof args[index] !== "number") {
    return {
      ok: false,
      message: `La llamada "${context}" espera ${label} numerico.`,
    };
  }

  return {
    ok: true,
    value: args[index],
  };
}

function getSingleCharacterArgument(
  context: string,
  value: ExecutionValue,
): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof value !== "string") {
    return {
      ok: false,
      message: `${context} espera un caracter de texto.`,
    };
  }

  if (value.length === 0) {
    return {
      ok: false,
      message: `${context} no acepta un texto vacio; espera un caracter.`,
    };
  }

  if (Array.from(value).length !== 1) {
    return {
      ok: false,
      message: `${context} espera exactamente un caracter.`,
    };
  }

  return {
    ok: true,
    value,
  };
}

function getFiniteNumberArgument(
  context: string,
  value: ExecutionValue,
  label: string,
): { ok: true; value: number } | { ok: false; message: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      ok: false,
      message: `${context} espera ${label} numerico finito.`,
    };
  }

  return {
    ok: true,
    value,
  };
}

function getCodePointArgument(
  context: string,
  value: ExecutionValue,
): { ok: true; value: number } | { ok: false; message: string } {
  const numberResult = getFiniteNumberArgument(context, value, "codigo");

  if (!numberResult.ok) {
    return numberResult;
  }

  if (
    !Number.isInteger(numberResult.value) ||
    numberResult.value < 0 ||
    numberResult.value > 0x10ffff
  ) {
    return {
      ok: false,
      message: `${context} espera un codigo Unicode entero entre 0 y 1114111.`,
    };
  }

  return numberResult;
}

function createExpressionError(message: string): ExpressionEvaluationResult {
  return {
    ok: false,
    message,
  };
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

function applyUnaryBitwiseOperator(
  value: ExecutionValue,
  operator: "~",
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  if (typeof value !== "number") {
    return {
      ok: false,
      message: `El operador "${operator}" solo soporta numeros en esta version.`,
    };
  }

  return createExpressionValue(~value, variables);
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
    case "**":
      return createExpressionValue(leftValue ** rightValue, variables);
    default:
      return {
        ok: false,
        message: `Operador no soportado: "${operator}".`,
      };
  }
}

function applyBitwiseOperator(
  leftValue: ExecutionValue,
  operator: string,
  rightValue: ExecutionValue,
  variables: ExecutionVariables,
): ExpressionEvaluationResult {
  if (typeof leftValue !== "number" || typeof rightValue !== "number") {
    return {
      ok: false,
      message: `El operador "${operator}" solo soporta numeros en esta version.`,
    };
  }

  switch (operator) {
    case "&":
      return createExpressionValue(leftValue & rightValue, variables);
    case "|":
      return createExpressionValue(leftValue | rightValue, variables);
    case "^":
      return createExpressionValue(leftValue ^ rightValue, variables);
    case "<<":
      return createExpressionValue(leftValue << rightValue, variables);
    case ">>":
      return createExpressionValue(leftValue >> rightValue, variables);
    case ">>>":
      return createExpressionValue(leftValue >>> rightValue, variables);
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
    operator === "%" ||
    operator === "**"
  );
}

function isBitwiseOperator(operator: string) {
  return (
    operator === "&" ||
    operator === "|" ||
    operator === "^" ||
    operator === "<<" ||
    operator === ">>" ||
    operator === ">>>"
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

function getExecutionTypeName(value: ExecutionValue) {
  if (value === null) {
    return "object";
  }

  if (Array.isArray(value)) {
    return "object";
  }

  return typeof value;
}
