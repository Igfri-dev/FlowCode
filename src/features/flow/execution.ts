import { parseExpression } from "@babel/parser";
import type {
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  Expression,
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
        "Instruccion vacia. Usa asignaciones, actualizaciones o declaraciones como x = 5, x++, x += 1 o let x = 5.",
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
      expression.type !== "SequenceExpression"
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
};

const safeMathCalls: Record<string, SafeCallable> = {
  abs: (args) => callNumberMathFunction("Math.abs", Math.abs, args),
  max: (args) => callVariadicNumberMathFunction("Math.max", Math.max, args),
  min: (args) => callVariadicNumberMathFunction("Math.min", Math.min, args),
  floor: (args) => callNumberMathFunction("Math.floor", Math.floor, args),
  ceil: (args) => callNumberMathFunction("Math.ceil", Math.ceil, args),
  round: (args) => callNumberMathFunction("Math.round", Math.round, args),
  pow: (args) => {
    if (args.length !== 2) {
      return {
        ok: false,
        message: "Math.pow espera exactamente 2 argumento(s).",
      };
    }

    if (typeof args[0] !== "number" || typeof args[1] !== "number") {
      return {
        ok: false,
        message: "Math.pow solo soporta argumentos numericos.",
      };
    }

    return createSafeCallValue(Math.pow(args[0], args[1]));
  },
};

const safeStringMethods: Record<string, (value: string) => ExecutionValue> = {
  toUpperCase: (value) => value.toUpperCase(),
  toLowerCase: (value) => value.toLowerCase(),
  trim: (value) => value.trim(),
};

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

    const stringMethodName = staticMember?.propertyName;

    if (stringMethodName && stringMethodName in safeStringMethods) {
      if (callee.object.type === "Super") {
        return {
          ok: false,
          message: "super no esta soportado en llamadas.",
        };
      }

      const objectResult = evaluateExpressionNode(callee.object, variables);

      if (!objectResult.ok) {
        return objectResult;
      }

      if (objectResult.value === null || objectResult.value === undefined) {
        if (isOptionalMemberAccess(callee) || expression.type === "OptionalCallExpression") {
          return {
            ok: true,
            callable: () => createSafeCallValue(undefined),
            variables: objectResult.variables,
            optionalShortCircuited: true,
          };
        }

        return {
          ok: false,
          message: `No se puede llamar ".${stringMethodName}()" sobre null o undefined.`,
        };
      }

      if (typeof objectResult.value !== "string") {
        return {
          ok: false,
          message: `La llamada ".${stringMethodName}()" solo esta permitida para textos.`,
        };
      }

      return {
        ok: true,
        callable: (args) => {
          if (args.length !== 0) {
            return {
              ok: false,
              message: `La llamada ".${stringMethodName}()" no recibe argumentos.`,
            };
          }

          return createSafeCallValue(
            safeStringMethods[stringMethodName](objectResult.value as string),
          );
        },
        variables: objectResult.variables,
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
      "Llamada no permitida. Usa solo Number, String, Boolean, Math.abs/max/min/floor/ceil/round/pow o metodos seguros de texto.",
  };
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
