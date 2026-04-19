import {
  createFlowGraph,
  getIncomingEdges,
  getOutgoingEdges,
  getOutgoingEdgesByHandle,
  type FlowConnectionLike,
  type FlowGraph,
} from "@/features/flow/flow-graph";
import type {
  FlowDecisionControlFlow,
  FlowEditorEdge,
  FlowEditorNode,
  FlowFunctionDefinition,
  FlowFunctionParameterDefinition,
  FlowPendingConnectionReference,
  FlowProcessControlFlow,
} from "@/types/flow";

type DecisionBranchHandle = "yes" | "no";

type GenerateJavaScriptInput = {
  nodes: FlowEditorNode[];
  edges: FlowEditorEdge[];
  functions?: FlowFunctionDefinition[];
};

export type FlowCodeGenerationResult = {
  code: string;
  warnings: string[];
};

type BackwardLoopInfo = {
  targetNodeId: string;
  decisionNodeId: string;
  loopBranch: DecisionBranchHandle;
  exitBranch: DecisionBranchHandle;
  condition: string;
};

type InferredForLoop = {
  initNodeId: string;
  decisionNode: FlowEditorNode;
  updateNodeId: string;
  setupInstructions: InferredForSetupInstruction[];
  init: string;
  condition: string;
  update: string;
  bodyEntryId?: string;
  exitBranch: DecisionBranchHandle;
  emitInitBeforeLoop: boolean;
};

type InferredForSetupInstruction = {
  nodeId: string;
  instruction: string;
};

type InferredSwitchCase = {
  test: string;
  entryId: string;
};

type InferredSwitchStatement = {
  discriminant: string;
  cases: InferredSwitchCase[];
  caseDecisionIds: string[];
  defaultEntryId?: string;
  exitNodeId?: string;
};

type SwitchComparison = {
  discriminant: string;
  test: string;
};

type RenderContext = {
  graph: FlowGraph;
  warnings: string[];
  lines: string[];
  activePath: Set<string>;
  emittedNodeIds: Set<string>;
  backwardLoopByTargetId: Map<string, BackwardLoopInfo>;
  indentLevel: number;
  stopNodeId?: string;
  disabledLoopTargetId?: string;
  functionsById?: Map<string, FlowFunctionDefinition>;
};

const indent = "  ";
const decisionBranches: DecisionBranchHandle[] = ["yes", "no"];

export function generateJavaScriptFromFlow({
  nodes,
  edges,
  functions = [],
}: GenerateJavaScriptInput): FlowCodeGenerationResult {
  const graph = createFlowGraph(nodes, edges);
  const startNodes = nodes.filter((node) => node.type === "start");
  const warnings: string[] = [];
  const functionsById = new Map(functions.map((item) => [item.id, item]));

  if (startNodes.length !== 1) {
    warnings.push(
      startNodes.length === 0
        ? "No se encontró un bloque Inicio para generar el código."
        : "Hay más de un bloque Inicio; se usará el primero encontrado.",
    );
  }

  const startNode = startNodes[0];

  if (!startNode) {
    return {
      code: "// No se pudo generar código: falta un bloque Inicio.",
      warnings,
    };
  }

  const lines = ["// Codigo generado desde FlowCode"];
  lines.push(...getRuntimeHelperLines(nodes, functions));

  for (const flowFunction of functions) {
    renderFunctionDefinition(flowFunction, {
      warnings,
      lines,
      functionsById,
    });
  }

  lines.push("");
  lines.push("async function main() {");
  const backwardLoopByTargetId = findBackwardLoops(graph, startNode.id);
  const startEdge = getFirstOutgoingEdge(graph, startNode.id);

  if (!startEdge) {
    warnings.push("El bloque Inicio no tiene una conexión de salida.");
    lines.push(`${indent}// El programa aun no tiene instrucciones conectadas.`);
  } else {
    renderSequence(startEdge.target, {
      graph,
      warnings,
      lines,
      activePath: new Set(),
      emittedNodeIds: new Set(),
      backwardLoopByTargetId,
      indentLevel: 1,
      functionsById,
    });
  }

  lines.push("}");
  lines.push("");
  lines.push("main();");

  return {
    code: lines.join("\n"),
    warnings,
  };
}

function renderSequence(nodeId: string | undefined, context: RenderContext) {
  if (!nodeId || nodeId === context.stopNodeId) {
    return;
  }

  const node = context.graph.nodeById.get(nodeId);

  if (!node) {
    context.warnings.push(
      `No se pudo generar una sección porque el bloque "${nodeId}" no existe.`,
    );
    return;
  }

  const loopInfo =
    context.disabledLoopTargetId === node.id
      ? undefined
      : context.backwardLoopByTargetId.get(node.id);

  if (loopInfo) {
    renderBackwardLoop(loopInfo, context);
    return;
  }

  if (context.activePath.has(node.id)) {
    addLine(
      context,
      `// Se detectó un retorno hacia "${getNodeDescription(node)}".`,
    );
    return;
  }

  if (context.emittedNodeIds.has(node.id) && node.type !== "end") {
    addLine(
      context,
      `// "${getNodeDescription(node)}" ya fue generado antes.`,
    );
    return;
  }

  context.activePath.add(node.id);

  try {
    if (node.type === "start") {
      renderSequence(getFirstOutgoingEdge(context.graph, node.id)?.target, {
        ...context,
        activePath: new Set(context.activePath),
      });
      return;
    }

    if (node.type === "end") {
      addLine(context, "// Fin del programa.");
      return;
    }

    if (node.type === "process") {
      const controlFlow = getProcessControlFlow(node);

      if (controlFlow?.kind === "forInit") {
        const decisionNode = context.graph.nodeById.get(
          controlFlow.loopDecisionId,
        );

        if (decisionNode?.type === "decision") {
          renderForLoop(decisionNode, context);
          return;
        }
      }

      const inferredForLoop = inferForLoopFromInitializer(node, context);

      if (inferredForLoop) {
        renderInferredForLoop(inferredForLoop, context);
        return;
      }

      context.emittedNodeIds.add(node.id);

      if (controlFlow?.kind === "break" || isControlInstruction(node, "break")) {
        addLine(context, "break;");
        return;
      }

      if (
        controlFlow?.kind === "continue" ||
        isControlInstruction(node, "continue")
      ) {
        addLine(context, "continue;");
        return;
      }

      addLine(context, formatInstruction(getProcessInstruction(node)));
      renderSequence(getFirstOutgoingEdge(context.graph, node.id)?.target, {
        ...context,
        activePath: new Set(context.activePath),
      });
      return;
    }

    if (node.type === "input") {
      context.emittedNodeIds.add(node.id);
      addLine(context, formatInputInstruction(node));
      renderSequence(getFirstOutgoingEdge(context.graph, node.id)?.target, {
        ...context,
        activePath: new Set(context.activePath),
      });
      return;
    }

    if (node.type === "output") {
      context.emittedNodeIds.add(node.id);
      addLine(context, formatOutputInstruction(node));
      renderSequence(getFirstOutgoingEdge(context.graph, node.id)?.target, {
        ...context,
        activePath: new Set(context.activePath),
      });
      return;
    }

    if (node.type === "functionCall") {
      context.emittedNodeIds.add(node.id);
      addLine(context, formatFunctionCallInstruction(node, context));
      renderSequence(getFirstOutgoingEdge(context.graph, node.id)?.target, {
        ...context,
        activePath: new Set(context.activePath),
      });
      return;
    }

    if (node.type === "return") {
      context.emittedNodeIds.add(node.id);
      addLine(context, formatReturnInstruction(node));
      return;
    }

    if (node.type === "decision") {
      context.emittedNodeIds.add(node.id);
      const controlFlow = getDecisionControlFlow(node);

      if (controlFlow?.kind === "for") {
        renderForLoop(node, context);
        return;
      }

      if (controlFlow?.kind === "doWhile") {
        renderDoWhileLoop(
          {
            targetNodeId: controlFlow.bodyEntryId ?? node.id,
            decisionNodeId: node.id,
            loopBranch: "yes",
            exitBranch: "no",
            condition: getDecisionCondition(node),
          },
          context,
        );
        return;
      }

      if (controlFlow?.kind === "switch") {
        renderSwitchStatement(node, controlFlow, context);
        return;
      }

      const inferredSwitch = inferSwitchStatement(node, context);

      if (inferredSwitch) {
        renderInferredSwitchStatement(inferredSwitch, context);
        return;
      }

      renderDecision(node, context);
    }
  } finally {
    context.activePath.delete(node.id);
  }
}

function renderFunctionDefinition(
  flowFunction: FlowFunctionDefinition,
  {
    warnings,
    lines,
    functionsById,
  }: {
    warnings: string[];
    lines: string[];
    functionsById: Map<string, FlowFunctionDefinition>;
  },
) {
  const graph = createFlowGraph(flowFunction.nodes, flowFunction.edges);
  const startNode = flowFunction.nodes.find((node) => node.type === "start");
  const functionName = toSafeIdentifier(flowFunction.name, "funcion");
  const parameters = getFunctionParametersForCode(flowFunction).join(", ");

  lines.push("");
  lines.push(`async function ${functionName}(${parameters}) {`);

  if (!startNode) {
    warnings.push(`La funcion "${flowFunction.name}" no tiene bloque Inicio.`);
    lines.push(`${indent}// Falta el bloque Inicio.`);
    lines.push("}");
    return;
  }

  const startEdge = getFirstOutgoingEdge(graph, startNode.id);

  if (!startEdge) {
    warnings.push(
      `La funcion "${flowFunction.name}" no tiene instrucciones conectadas.`,
    );
    lines.push(`${indent}// La funcion aun no tiene instrucciones conectadas.`);
    lines.push("}");
    return;
  }

  renderSequence(startEdge.target, {
    graph,
    warnings,
    lines,
    activePath: new Set(),
    emittedNodeIds: new Set(),
    backwardLoopByTargetId: findBackwardLoops(graph, startNode.id),
    indentLevel: 1,
    functionsById,
  });
  lines.push("}");
}

function renderDecision(node: FlowEditorNode, context: RenderContext) {
  const loopBranch = findTopTestedLoopBranch(
    context.graph,
    node,
    context.activePath,
  );

  if (loopBranch) {
    renderTopTestedLoop(node, loopBranch, context);
    return;
  }

  const condition = getDecisionCondition(node);
  const yesEdge = getDecisionBranchEdge(context.graph, node.id, "yes");
  const noEdge = getDecisionBranchEdge(context.graph, node.id, "no");

  if (!yesEdge && !noEdge) {
    addLine(context, `// Decisión sin ramas: ${condition}`);
    context.warnings.push(
      `La decisión "${getNodeDescription(node)}" no tiene ramas de salida.`,
    );
    return;
  }

  if (yesEdge && noEdge && yesEdge.target === noEdge.target) {
    addLine(context, `// Ambas ramas de "${condition}" continúan igual.`);
    renderSequence(yesEdge.target, {
      ...context,
      activePath: new Set(context.activePath),
    });
    return;
  }

  const joinNodeId =
    yesEdge && noEdge
      ? findFirstSharedReachableNode(
          context.graph,
          yesEdge.target,
          noEdge.target,
          new Set([node.id]),
        )
      : undefined;

  if (yesEdge && noEdge) {
    addLine(context, `if (${condition}) {`);
    renderSequence(yesEdge.target, {
      ...context,
      activePath: new Set(context.activePath),
      indentLevel: context.indentLevel + 1,
      stopNodeId: joinNodeId,
    });
    addLine(context, "} else {");
    renderSequence(noEdge.target, {
      ...context,
      activePath: new Set(context.activePath),
      indentLevel: context.indentLevel + 1,
      stopNodeId: joinNodeId,
    });
    addLine(context, "}");

    if (joinNodeId) {
      renderSequence(joinNodeId, {
        ...context,
        activePath: new Set(context.activePath),
      });
    }

    return;
  }

  if (yesEdge) {
    addLine(context, `if (${condition}) {`);
    renderSequence(yesEdge.target, {
      ...context,
      activePath: new Set(context.activePath),
      indentLevel: context.indentLevel + 1,
    });
    addLine(context, "}");
    context.warnings.push(
      `La decisión "${getNodeDescription(node)}" no tiene rama No.`,
    );
    return;
  }

  if (noEdge) {
    addLine(context, `if (!(${condition})) {`);
    renderSequence(noEdge.target, {
      ...context,
      activePath: new Set(context.activePath),
      indentLevel: context.indentLevel + 1,
    });
    addLine(context, "}");
    context.warnings.push(
      `La decisión "${getNodeDescription(node)}" no tiene rama Sí.`,
    );
  }
}

function renderTopTestedLoop(
  decisionNode: FlowEditorNode,
  loopBranch: DecisionBranchHandle,
  context: RenderContext,
) {
  const condition = getDecisionCondition(decisionNode);
  const loopEdge = getDecisionBranchEdge(
    context.graph,
    decisionNode.id,
    loopBranch,
  );
  const exitBranch = getOppositeBranch(loopBranch);
  const exitEdge = getDecisionBranchEdge(
    context.graph,
    decisionNode.id,
    exitBranch,
  );

  addLine(context, `while (${formatLoopCondition(condition, loopBranch)}) {`);

  if (loopEdge?.target === decisionNode.id) {
    addLine(
      {
        ...context,
        indentLevel: context.indentLevel + 1,
      },
      "// La rama vuelve directamente a evaluar la condición.",
    );
  } else {
    renderSequence(loopEdge?.target, {
      ...context,
      activePath: new Set(context.activePath),
      indentLevel: context.indentLevel + 1,
      stopNodeId: decisionNode.id,
    });
  }

  addLine(context, "}");

  if (exitEdge) {
    renderSequence(exitEdge.target, {
      ...context,
      activePath: new Set(context.activePath),
    });
  } else {
    context.warnings.push(
      `La decisión "${getNodeDescription(decisionNode)}" no tiene rama de salida para terminar el ciclo.`,
    );
  }
}

function renderInferredForLoop(
  loop: InferredForLoop,
  context: RenderContext,
) {
  for (const setupInstruction of loop.setupInstructions) {
    context.emittedNodeIds.add(setupInstruction.nodeId);
  }

  context.emittedNodeIds.add(loop.decisionNode.id);
  context.emittedNodeIds.add(loop.updateNodeId);

  for (const setupInstruction of loop.setupInstructions) {
    if (
      setupInstruction.nodeId === loop.initNodeId &&
      !loop.emitInitBeforeLoop
    ) {
      continue;
    }

    addLine(context, formatInstruction(setupInstruction.instruction));
  }

  addLine(
    context,
    `for (${loop.emitInitBeforeLoop ? "" : loop.init}; ${loop.condition}; ${
      loop.update
    }) {`,
  );

  if (loop.bodyEntryId) {
    renderSequence(loop.bodyEntryId, {
      ...context,
      activePath: new Set(context.activePath),
      indentLevel: context.indentLevel + 1,
      stopNodeId: loop.updateNodeId,
    });
  }

  addLine(context, "}");

  const exitEdge = getDecisionBranchEdge(
    context.graph,
    loop.decisionNode.id,
    loop.exitBranch,
  );

  if (exitEdge) {
    renderSequence(exitEdge.target, {
      ...context,
      activePath: new Set(context.activePath),
    });
  } else {
    context.warnings.push(
      `El ciclo for "${getNodeDescription(loop.decisionNode)}" no tiene rama de salida.`,
    );
  }
}

function renderForLoop(decisionNode: FlowEditorNode, context: RenderContext) {
  const controlFlow = getDecisionControlFlow(decisionNode);

  if (controlFlow?.kind !== "for") {
    renderDecision(decisionNode, context);
    return;
  }

  const condition = controlFlow.test ?? "";
  const init = controlFlow.init.trim();
  const update = controlFlow.update.trim();

  context.emittedNodeIds.add(decisionNode.id);

  for (const nodeId of controlFlow.initNodeIds) {
    context.emittedNodeIds.add(nodeId);
  }

  if (controlFlow.updateNodeId) {
    context.emittedNodeIds.add(controlFlow.updateNodeId);
  }

  addLine(context, `for (${init}; ${condition}; ${update}) {`);

  if (controlFlow.bodyEntryId) {
    renderSequence(controlFlow.bodyEntryId, {
      ...context,
      activePath: new Set(context.activePath),
      indentLevel: context.indentLevel + 1,
      stopNodeId: controlFlow.updateNodeId ?? decisionNode.id,
    });
  }

  addLine(context, "}");

  const exitEdge = getDecisionBranchEdge(context.graph, decisionNode.id, "no");

  if (exitEdge) {
    renderSequence(exitEdge.target, {
      ...context,
      activePath: new Set(context.activePath),
    });
  } else {
    context.warnings.push(
      `El ciclo for "${getNodeDescription(decisionNode)}" no tiene rama de salida.`,
    );
  }
}

function renderDoWhileLoop(
  loopInfo: BackwardLoopInfo,
  context: RenderContext,
) {
  context.emittedNodeIds.add(loopInfo.decisionNodeId);

  addLine(context, "do {");

  if (loopInfo.targetNodeId !== loopInfo.decisionNodeId) {
    renderSequence(loopInfo.targetNodeId, {
      ...context,
      activePath: new Set(context.activePath),
      indentLevel: context.indentLevel + 1,
      stopNodeId: loopInfo.decisionNodeId,
      disabledLoopTargetId: loopInfo.targetNodeId,
    });
  }

  addLine(
    context,
    `} while (${formatLoopCondition(loopInfo.condition, loopInfo.loopBranch)});`,
  );

  const exitEdge = getDecisionBranchEdge(
    context.graph,
    loopInfo.decisionNodeId,
    loopInfo.exitBranch,
  );

  if (exitEdge) {
    renderSequence(exitEdge.target, {
      ...context,
      activePath: new Set(context.activePath),
    });
  } else {
    context.warnings.push("El ciclo do while no tiene rama de salida.");
  }
}

function renderSwitchStatement(
  node: FlowEditorNode,
  controlFlow: Extract<FlowDecisionControlFlow, { kind: "switch" }>,
  context: RenderContext,
) {
  context.emittedNodeIds.add(node.id);

  for (const decisionId of controlFlow.caseDecisionIds) {
    context.emittedNodeIds.add(decisionId);
  }

  const exitNodeId = findSwitchExitNodeId(controlFlow, context.graph);

  addLine(context, `switch (${controlFlow.discriminant}) {`);

  controlFlow.cases.forEach((switchCase, index) => {
    const label =
      switchCase.test === null ? "default:" : `case ${switchCase.test}:`;

    addLine(
      {
        ...context,
        indentLevel: context.indentLevel + 1,
      },
      label,
    );

    if (switchCase.entryId) {
      renderSequence(switchCase.entryId, {
        ...context,
        activePath: new Set(context.activePath),
        indentLevel: context.indentLevel + 2,
        stopNodeId:
          findNextSwitchCaseEntryId(controlFlow, index + 1) ?? exitNodeId,
      });
    }
  });

  addLine(context, "}");

  if (exitNodeId) {
    renderSequence(exitNodeId, {
      ...context,
      activePath: new Set(context.activePath),
    });
  }
}

function renderInferredSwitchStatement(
  switchStatement: InferredSwitchStatement,
  context: RenderContext,
) {
  for (const decisionId of switchStatement.caseDecisionIds) {
    context.emittedNodeIds.add(decisionId);
  }

  addLine(context, `switch (${switchStatement.discriminant}) {`);

  for (const switchCase of switchStatement.cases) {
    addLine(
      {
        ...context,
        indentLevel: context.indentLevel + 1,
      },
      `case ${switchCase.test}:`,
    );

    renderSequence(switchCase.entryId, {
      ...context,
      activePath: new Set(context.activePath),
      indentLevel: context.indentLevel + 2,
      stopNodeId: switchStatement.exitNodeId,
    });

    addLine(
      {
        ...context,
        indentLevel: context.indentLevel + 2,
      },
      "break;",
    );
  }

  if (
    switchStatement.defaultEntryId &&
    switchStatement.defaultEntryId !== switchStatement.exitNodeId
  ) {
    addLine(
      {
        ...context,
        indentLevel: context.indentLevel + 1,
      },
      "default:",
    );
    renderSequence(switchStatement.defaultEntryId, {
      ...context,
      activePath: new Set(context.activePath),
      indentLevel: context.indentLevel + 2,
      stopNodeId: switchStatement.exitNodeId,
    });
  }

  addLine(context, "}");

  if (switchStatement.exitNodeId) {
    renderSequence(switchStatement.exitNodeId, {
      ...context,
      activePath: new Set(context.activePath),
    });
  }
}

function renderBackwardLoop(
  loopInfo: BackwardLoopInfo,
  context: RenderContext,
) {
  const decisionNode = context.graph.nodeById.get(loopInfo.decisionNodeId);

  if (!decisionNode) {
    context.warnings.push(
      "No se pudo generar un ciclo porque falta la decisión asociada.",
    );
    return;
  }

  renderDoWhileLoop(loopInfo, context);
}

function findBackwardLoops(
  graph: FlowGraph,
  startNodeId: string,
): Map<string, BackwardLoopInfo> {
  const loops = new Map<string, BackwardLoopInfo>();

  for (const node of graph.nodes) {
    if (node.type !== "decision") {
      continue;
    }

    for (const branch of decisionBranches) {
      const edge = getDecisionBranchEdge(graph, node.id, branch);

      if (!edge) {
        continue;
      }

      if (graph.nodeById.get(edge.target)?.type === "decision") {
        continue;
      }

      const excludedEdges = new Set([getEdgeKey(edge)]);
      const startToDecisionPath = findPath(graph, startNodeId, node.id, {
        excludedEdges,
      });

      if (!startToDecisionPath.includes(edge.target)) {
        continue;
      }

      const targetToDecisionPath = findPath(graph, edge.target, node.id, {
        excludedEdges,
      });

      if (targetToDecisionPath.length === 0) {
        continue;
      }

      loops.set(edge.target, {
        targetNodeId: edge.target,
        decisionNodeId: node.id,
        loopBranch: branch,
        exitBranch: getOppositeBranch(branch),
        condition: getDecisionCondition(node),
      });
    }
  }

  return loops;
}

function findTopTestedLoopBranch(
  graph: FlowGraph,
  decisionNode: FlowEditorNode,
  activePath: Set<string>,
): DecisionBranchHandle | null {
  const blockedNodeIds = new Set(activePath);

  blockedNodeIds.delete(decisionNode.id);

  for (const branch of decisionBranches) {
    const edge = getDecisionBranchEdge(graph, decisionNode.id, branch);

    if (!edge) {
      continue;
    }

    if (edge.target === decisionNode.id) {
      return branch;
    }

    const pathBackToDecision = findPath(graph, edge.target, decisionNode.id, {
      blockedNodeIds,
    });

    if (pathBackToDecision.length > 0) {
      return branch;
    }
  }

  return null;
}

function inferForLoopFromInitializer(
  initNode: FlowEditorNode,
  context: RenderContext,
): InferredForLoop | null {
  const setupChain = collectForSetupChain(initNode, context);

  if (!setupChain) {
    return null;
  }

  const { decisionNode, setupNodes } = setupChain;

  if (getDecisionControlFlow(decisionNode)) {
    return null;
  }

  const loopBranch = findTopTestedLoopBranch(
    context.graph,
    decisionNode,
    context.activePath,
  );

  if (!loopBranch) {
    return null;
  }

  const loopEdge = getDecisionBranchEdge(
    context.graph,
    decisionNode.id,
    loopBranch,
  );
  const bodyEntryId = loopEdge?.target;

  if (!bodyEntryId) {
    return null;
  }

  const condition = formatLoopCondition(
    getDecisionCondition(decisionNode),
    loopBranch,
  );
  const setupInstructions = setupNodes.map((node) => ({
    nodeId: node.id,
    instruction: getForHeaderInstruction(node),
  }));

  for (const setupNode of setupNodes) {
    const init = getForHeaderInstruction(setupNode);
    const initVariable = getInitializerVariable(init);

    if (
      !initVariable ||
      !expressionReferencesIdentifier(condition, initVariable)
    ) {
      continue;
    }

    const updateNode = findForUpdateNode(
      context.graph,
      decisionNode.id,
      bodyEntryId,
      initVariable,
    );

    if (!updateNode) {
      continue;
    }

    const update = getForHeaderInstruction(updateNode);
    const exitBranch = getOppositeBranch(loopBranch);

    return {
      initNodeId: setupNode.id,
      decisionNode,
      updateNodeId: updateNode.id,
      setupInstructions,
      init,
      condition,
      update,
      bodyEntryId,
      exitBranch,
      emitInitBeforeLoop: shouldEmitInitializerBeforeForLoop(
        context.graph,
        decisionNode.id,
        exitBranch,
        init,
        initVariable,
        setupNodes.filter((node) => node.id !== setupNode.id),
      ),
    };
  }

  return null;
}

function collectForSetupChain(
  startNode: FlowEditorNode,
  context: RenderContext,
) {
  if (startNode.type !== "process") {
    return null;
  }

  const setupNodes: FlowEditorNode[] = [];
  const visitedNodeIds = new Set<string>();
  let currentNode: FlowEditorNode | undefined = startNode;

  while (currentNode?.type === "process") {
    const controlFlow = getProcessControlFlow(currentNode);

    if (
      context.emittedNodeIds.has(currentNode.id) ||
      visitedNodeIds.has(currentNode.id) ||
      controlFlow?.kind === "break" ||
      controlFlow?.kind === "continue" ||
      controlFlow?.kind === "forUpdate" ||
      isControlInstruction(currentNode, "break") ||
      isControlInstruction(currentNode, "continue")
    ) {
      return null;
    }

    visitedNodeIds.add(currentNode.id);
    setupNodes.push(currentNode);

    const outgoingEdges = getOutgoingEdges(context.graph, currentNode.id);

    if (outgoingEdges.length !== 1) {
      return null;
    }

    const nextNode = context.graph.nodeById.get(outgoingEdges[0].target);

    if (nextNode?.type === "decision") {
      return {
        decisionNode: nextNode,
        setupNodes,
      };
    }

    if (nextNode?.type !== "process") {
      return null;
    }

    currentNode = nextNode;
  }

  return null;
}

function findForUpdateNode(
  graph: FlowGraph,
  decisionNodeId: string,
  bodyEntryId: string,
  variableName: string,
) {
  for (const edge of getIncomingEdges(graph, decisionNodeId)) {
    const candidateNode = graph.nodeById.get(edge.source);

    if (!candidateNode || candidateNode.type !== "process") {
      continue;
    }

    const update = getForHeaderInstruction(candidateNode);

    if (getUpdateVariable(update) !== variableName) {
      continue;
    }

    const pathToUpdate = findPath(graph, bodyEntryId, candidateNode.id, {
      blockedNodeIds: new Set([decisionNodeId]),
    });

    if (pathToUpdate.length > 0) {
      return candidateNode;
    }
  }

  return null;
}

function shouldEmitInitializerBeforeForLoop(
  graph: FlowGraph,
  decisionNodeId: string,
  exitBranch: DecisionBranchHandle,
  init: string,
  variableName: string,
  setupNodes: FlowEditorNode[],
) {
  if (!isMovableForInitializer(init, variableName)) {
    return true;
  }

  if (setupNodes.some((node) => nodeReferencesIdentifier(node, variableName))) {
    return true;
  }

  const exitEdge = getDecisionBranchEdge(graph, decisionNodeId, exitBranch);

  if (!exitEdge) {
    return false;
  }

  return reachableNodesReferenceIdentifier(
    graph,
    exitEdge.target,
    variableName,
    new Set([decisionNodeId]),
  );
}

function isMovableForInitializer(instruction: string, variableName: string) {
  const escapedVariableName = escapeRegExp(variableName);
  const literalValuePattern =
    String.raw`(?:-?\d+(?:\.\d+)?|true|false|null|undefined|"[^"]*"|'[^']*'|` +
    "`[^`]*`)";
  const declarationPattern = new RegExp(
    String.raw`^(?:let|var|const)\s+${escapedVariableName}(?:\s*=\s*${literalValuePattern})?$`,
  );
  const assignmentPattern = new RegExp(
    String.raw`^${escapedVariableName}\s*=\s*${literalValuePattern}$`,
  );

  return (
    declarationPattern.test(instruction) || assignmentPattern.test(instruction)
  );
}

function reachableNodesReferenceIdentifier(
  graph: FlowGraph,
  startNodeId: string,
  identifier: string,
  blockedNodeIds: Set<string>,
) {
  const visited = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId || visited.has(nodeId) || blockedNodeIds.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);

    const node = graph.nodeById.get(nodeId);

    if (node && nodeReferencesIdentifier(node, identifier)) {
      return true;
    }

    for (const edge of getOutgoingEdges(graph, nodeId)) {
      queue.push(edge.target);
    }
  }

  return false;
}

function inferSwitchStatement(
  rootNode: FlowEditorNode,
  context: RenderContext,
): InferredSwitchStatement | null {
  const rootComparison = parseSwitchComparison(getDecisionCondition(rootNode));

  if (!rootComparison) {
    return null;
  }

  const discriminant = rootComparison.discriminant;
  const cases: InferredSwitchCase[] = [];
  const caseDecisionIds: string[] = [];
  const visitedDecisionIds = new Set<string>();
  let currentNode: FlowEditorNode | undefined = rootNode;
  let currentComparison: SwitchComparison | null = rootComparison;
  let defaultEntryId: string | undefined;

  while (currentNode?.type === "decision" && currentComparison) {
    if (
      visitedDecisionIds.has(currentNode.id) ||
      normalizeExpression(currentComparison.discriminant) !==
        normalizeExpression(discriminant) ||
      findTopTestedLoopBranch(context.graph, currentNode, context.activePath)
    ) {
      return null;
    }

    const yesEdge = getDecisionBranchEdge(context.graph, currentNode.id, "yes");
    const noEdge = getDecisionBranchEdge(context.graph, currentNode.id, "no");

    if (!yesEdge) {
      return null;
    }

    visitedDecisionIds.add(currentNode.id);
    caseDecisionIds.push(currentNode.id);
    cases.push({
      test: currentComparison.test,
      entryId: yesEdge.target,
    });

    if (!noEdge) {
      break;
    }

    const nextNode = context.graph.nodeById.get(noEdge.target);
    const nextComparison =
      nextNode?.type === "decision"
        ? parseSwitchComparison(getDecisionCondition(nextNode))
        : null;

    if (
      !nextNode ||
      nextNode.type !== "decision" ||
      !nextComparison ||
      normalizeExpression(nextComparison.discriminant) !==
        normalizeExpression(discriminant)
    ) {
      defaultEntryId = noEdge.target;
      break;
    }

    currentNode = nextNode;
    currentComparison = nextComparison;
  }

  if (cases.length < 2) {
    return null;
  }

  const exitNodeId = findFirstCommonReachableNode(
    context.graph,
    [
      ...cases.map((switchCase) => switchCase.entryId),
      ...(defaultEntryId ? [defaultEntryId] : []),
    ],
    new Set(caseDecisionIds),
  );

  if (!exitNodeId) {
    return null;
  }

  return {
    discriminant,
    cases,
    caseDecisionIds,
    defaultEntryId,
    exitNodeId,
  };
}

function findFirstSharedReachableNode(
  graph: FlowGraph,
  firstNodeId: string,
  secondNodeId: string,
  blockedNodeIds: Set<string>,
) {
  const firstDistances = collectReachableDistances(
    graph,
    firstNodeId,
    blockedNodeIds,
  );
  const secondDistances = collectReachableDistances(
    graph,
    secondNodeId,
    blockedNodeIds,
  );
  let bestNodeId: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [nodeId, firstDistance] of firstDistances) {
    const secondDistance = secondDistances.get(nodeId);

    if (secondDistance === undefined) {
      continue;
    }

    const totalDistance = firstDistance + secondDistance;

    if (totalDistance < bestDistance) {
      bestDistance = totalDistance;
      bestNodeId = nodeId;
    }
  }

  return bestNodeId;
}

function findFirstCommonReachableNode(
  graph: FlowGraph,
  startNodeIds: string[],
  blockedNodeIds: Set<string>,
) {
  const reachableDistances = startNodeIds.map((nodeId) =>
    collectReachableDistances(graph, nodeId, blockedNodeIds),
  );

  if (reachableDistances.length === 0) {
    return undefined;
  }

  let bestNodeId: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [nodeId] of reachableDistances[0]) {
    const distances = reachableDistances.map((items) => items.get(nodeId));

    let totalDistance = 0;

    for (const distance of distances) {
      if (distance === undefined) {
        totalDistance = Number.POSITIVE_INFINITY;
        break;
      }

      totalDistance += distance;
    }

    if (totalDistance < bestDistance) {
      bestDistance = totalDistance;
      bestNodeId = nodeId;
    }
  }

  return bestNodeId;
}

function collectReachableDistances(
  graph: FlowGraph,
  startNodeId: string,
  blockedNodeIds: Set<string>,
) {
  const distances = new Map<string, number>();
  const queue: Array<{ nodeId: string; distance: number }> = [
    { nodeId: startNodeId, distance: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || distances.has(current.nodeId)) {
      continue;
    }

    if (blockedNodeIds.has(current.nodeId)) {
      continue;
    }

    distances.set(current.nodeId, current.distance);

    for (const edge of getOutgoingEdges(graph, current.nodeId)) {
      queue.push({
        nodeId: edge.target,
        distance: current.distance + 1,
      });
    }
  }

  return distances;
}

function findPath(
  graph: FlowGraph,
  startNodeId: string,
  targetNodeId: string,
  options?: { blockedNodeIds?: Set<string>; excludedEdges?: Set<string> },
) {
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; path: string[] }> = [
    { nodeId: startNodeId, path: [startNodeId] },
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || visited.has(current.nodeId)) {
      continue;
    }

    if (
      current.nodeId !== targetNodeId &&
      options?.blockedNodeIds?.has(current.nodeId)
    ) {
      continue;
    }

    if (current.nodeId === targetNodeId) {
      return current.path;
    }

    visited.add(current.nodeId);

    for (const edge of getOutgoingEdges(graph, current.nodeId)) {
      if (options?.excludedEdges?.has(getEdgeKey(edge))) {
        continue;
      }

      queue.push({
        nodeId: edge.target,
        path: [...current.path, edge.target],
      });
    }
  }

  return [];
}

function getDecisionBranchEdge(
  graph: FlowGraph,
  nodeId: string,
  branch: DecisionBranchHandle,
) {
  return getOutgoingEdgesByHandle(graph, nodeId, branch)[0];
}

function findNextSwitchCaseEntryId(
  controlFlow: Extract<FlowDecisionControlFlow, { kind: "switch" }>,
  startIndex: number,
) {
  for (let index = startIndex; index < controlFlow.cases.length; index += 1) {
    const entryId = controlFlow.cases[index].entryId;

    if (entryId) {
      return entryId;
    }
  }

  return undefined;
}

function findSwitchExitNodeId(
  controlFlow: Extract<FlowDecisionControlFlow, { kind: "switch" }>,
  graph: FlowGraph,
) {
  for (const exitSource of controlFlow.exitSources) {
    const edge = findOutgoingEdgeFromReference(graph, exitSource);

    if (edge) {
      return edge.target;
    }
  }

  return undefined;
}

function findOutgoingEdgeFromReference(
  graph: FlowGraph,
  reference: FlowPendingConnectionReference,
) {
  return getOutgoingEdges(graph, reference.sourceId).find(
    (edge) => (edge.sourceHandle ?? "out") === reference.sourceHandle,
  );
}

function getFirstOutgoingEdge(graph: FlowGraph, nodeId: string) {
  return getOutgoingEdges(graph, nodeId)[0];
}

function getOppositeBranch(
  branch: DecisionBranchHandle,
): DecisionBranchHandle {
  return branch === "yes" ? "no" : "yes";
}

function formatLoopCondition(
  condition: string,
  branch: DecisionBranchHandle,
) {
  return branch === "yes" ? condition : `!(${condition})`;
}

function formatInstruction(instruction: string) {
  const trimmedInstruction = instruction.trim();

  if (!trimmedInstruction) {
    return "// Instrucción vacía.";
  }

  if (trimmedInstruction.endsWith(";")) {
    return trimmedInstruction;
  }

  return `${trimmedInstruction};`;
}

function getForHeaderInstruction(node: FlowEditorNode) {
  return getProcessInstruction(node).trim().replace(/;+$/, "").trim();
}

function getInitializerVariable(instruction: string) {
  const declarationMatch = instruction.match(
    /^(?:let|var|const)\s+([A-Za-z_$][\w$]*)\s*(?:=.*)?$/,
  );

  if (declarationMatch) {
    return declarationMatch[1];
  }

  const assignmentMatch = instruction.match(
    /^([A-Za-z_$][\w$]*)\s*=(?!=).*$/,
  );

  return assignmentMatch?.[1] ?? null;
}

function getUpdateVariable(instruction: string) {
  const postfixMatch = instruction.match(/^([A-Za-z_$][\w$]*)(?:\+\+|--)$/);

  if (postfixMatch) {
    return postfixMatch[1];
  }

  const prefixMatch = instruction.match(/^(?:\+\+|--)([A-Za-z_$][\w$]*)$/);

  if (prefixMatch) {
    return prefixMatch[1];
  }

  const compoundMatch = instruction.match(
    /^([A-Za-z_$][\w$]*)\s*(?:\+=|-=|\*=|\/=|%=)\s*.+$/,
  );

  if (compoundMatch) {
    return compoundMatch[1];
  }

  const assignmentMatch = instruction.match(
    /^([A-Za-z_$][\w$]*)\s*=\s*(.+)$/,
  );

  if (!assignmentMatch) {
    return null;
  }

  const [, assignee, expression] = assignmentMatch;

  return expressionReferencesIdentifier(expression, assignee) ? assignee : null;
}

function expressionReferencesIdentifier(expression: string, identifier: string) {
  return new RegExp(
    `(^|[^A-Za-z0-9_$])${escapeRegExp(identifier)}([^A-Za-z0-9_$]|$)`,
  ).test(expression);
}

function parseSwitchComparison(condition: string): SwitchComparison | null {
  const comparison = splitStrictEqualityComparison(condition);

  if (!comparison) {
    return null;
  }

  const [left, right] = comparison;

  if (isLikelySwitchCaseTest(left) && !isLikelySwitchCaseTest(right)) {
    return createSwitchComparison(right, left);
  }

  return createSwitchComparison(left, right);
}

function createSwitchComparison(
  discriminant: string,
  test: string,
): SwitchComparison | null {
  const normalizedDiscriminant = normalizeExpression(discriminant);
  const normalizedTest = normalizeExpression(test);

  if (
    !isSafeSwitchDiscriminant(normalizedDiscriminant) ||
    !isLikelySwitchCaseTest(normalizedTest)
  ) {
    return null;
  }

  return {
    discriminant: normalizedDiscriminant,
    test: normalizedTest,
  };
}

function splitStrictEqualityComparison(condition: string) {
  const normalizedCondition = stripWrappingParentheses(condition.trim());
  let quote: string | null = null;
  let escaping = false;
  let depth = 0;

  for (let index = 0; index < normalizedCondition.length - 2; index += 1) {
    const character = normalizedCondition[index];

    if (quote) {
      if (escaping) {
        escaping = false;
      } else if (character === "\\") {
        escaping = true;
      } else if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }

    if (character === "(" || character === "[" || character === "{") {
      depth += 1;
      continue;
    }

    if (character === ")" || character === "]" || character === "}") {
      depth -= 1;
      continue;
    }

    if (depth === 0 && normalizedCondition.slice(index, index + 3) === "===") {
      const left = normalizedCondition.slice(0, index).trim();
      const right = normalizedCondition.slice(index + 3).trim();

      return left && right ? [left, right] : null;
    }
  }

  return null;
}

function normalizeExpression(expression: string) {
  return stripWrappingParentheses(expression.trim());
}

function stripWrappingParentheses(expression: string) {
  let current = expression;

  while (current.startsWith("(") && current.endsWith(")")) {
    const inner = current.slice(1, -1).trim();

    if (!hasBalancedWrappingParentheses(current, inner)) {
      break;
    }

    current = inner;
  }

  return current;
}

function hasBalancedWrappingParentheses(expression: string, inner: string) {
  let quote: string | null = null;
  let escaping = false;
  let depth = 0;

  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];

    if (quote) {
      if (escaping) {
        escaping = false;
      } else if (character === "\\") {
        escaping = true;
      } else if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }

    if (character === "(") {
      depth += 1;
    }

    if (character === ")") {
      depth -= 1;
    }

    if (depth === 0 && index < expression.length - 1) {
      return false;
    }
  }

  return depth === 0 && inner.length > 0;
}

function isLikelySwitchCaseTest(expression: string) {
  const normalizedExpression = normalizeExpression(expression);

  return (
    /^["'`]/.test(normalizedExpression) ||
    /^-?\d+(?:\.\d+)?$/.test(normalizedExpression) ||
    /^(?:true|false|null|undefined)$/.test(normalizedExpression)
  );
}

function isSafeSwitchDiscriminant(expression: string) {
  return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(
    expression.replace(/\s+/g, ""),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nodeReferencesIdentifier(node: FlowEditorNode, identifier: string) {
  return getReferenceCandidateTexts(node).some((text) =>
    expressionReferencesIdentifier(text, identifier),
  );
}

function getReferenceCandidateTexts(node: FlowEditorNode) {
  if (node.type === "process") {
    return [getProcessInstruction(node)];
  }

  if (node.type === "decision") {
    return [getDecisionCondition(node)];
  }

  if (node.type === "output") {
    const config = node.data.config;

    return "outputMode" in config && config.outputMode === "expression"
      ? [config.expression]
      : [];
  }

  if (node.type === "functionCall") {
    const config = node.data.config;

    return "functionId" in config
      ? [...config.args, config.assignTo ?? ""]
      : [];
  }

  if (node.type === "return") {
    const config = node.data.config;

    return "expression" in config ? [config.expression] : [];
  }

  return [];
}

function formatInputInstruction(node: FlowEditorNode) {
  const config =
    "prompt" in node.data.config
      ? node.data.config
      : {
          prompt: "Ingresa un valor",
          variableName: "valor",
          inputType: "text" as const,
        };
  const variableName = toSafeIdentifier(config.variableName, "valor");

  return `let ${variableName} = await leerEntrada(${JSON.stringify(
    config.prompt,
  )}, ${JSON.stringify(config.inputType)});`;
}

function formatOutputInstruction(node: FlowEditorNode) {
  const config =
    "outputMode" in node.data.config
      ? node.data.config
      : {
          expression: node.data.label,
          outputMode: "text" as const,
        };
  const outputValue =
    config.outputMode === "text"
      ? JSON.stringify(config.expression)
      : config.expression.trim() || '""';

  return `console.log(${outputValue});`;
}

function formatFunctionCallInstruction(
  node: FlowEditorNode,
  context: RenderContext,
) {
  const config =
    "functionId" in node.data.config
      ? node.data.config
      : {
          functionId: "",
          args: [],
          assignTo: "",
        };
  const flowFunction = context.functionsById?.get(config.functionId);
  const functionName = toSafeIdentifier(flowFunction?.name ?? "funcion", "funcion");
  const callExpression = `await ${functionName}(${config.args.join(", ")})`;
  const assignTo = config.assignTo?.trim();

  if (assignTo) {
    return `${assignTo} = ${callExpression};`;
  }

  return `${callExpression};`;
}

function formatReturnInstruction(node: FlowEditorNode) {
  const expression =
    "expression" in node.data.config && !("outputMode" in node.data.config)
      ? getReturnExpression(node.data.config.expression)
      : "";

  return expression ? `return ${expression};` : "return;";
}

function getReturnExpression(expression: string) {
  const trimmedExpression = expression.trim().replace(/;$/, "").trim();

  return trimmedExpression.replace(/^return\b\s*/, "");
}

function getRuntimeHelperLines(
  nodes: FlowEditorNode[],
  functions: FlowFunctionDefinition[],
) {
  const allNodes = [
    ...nodes,
    ...functions.flatMap((flowFunction) => flowFunction.nodes),
  ];

  if (!allNodes.some((node) => node.type === "input")) {
    return [];
  }

  return [
    "",
    "async function leerEntrada(mensaje, tipo = \"text\") {",
    "  const valor = prompt(mensaje);",
    "  if (tipo === \"number\") return Number(valor);",
    "  if (tipo === \"boolean\") return valor === \"true\" || valor === \"si\";",
    "  return valor ?? \"\";",
    "}",
  ];
}

function toSafeIdentifier(value: string, fallback: string) {
  const normalized = value.trim().replace(/[^A-Za-z0-9_$]/g, "_");
  const identifier = normalized || fallback;

  return /^[A-Za-z_$]/.test(identifier) ? identifier : `_${identifier}`;
}

function getProcessInstruction(node: FlowEditorNode) {
  return "instruction" in node.data.config ? node.data.config.instruction : "";
}

function getDecisionCondition(node: FlowEditorNode) {
  const condition =
    "condition" in node.data.config ? node.data.config.condition.trim() : "";

  return condition || "true";
}

function getDecisionControlFlow(
  node: FlowEditorNode,
): FlowDecisionControlFlow | undefined {
  return "condition" in node.data.config
    ? node.data.config.controlFlow
    : undefined;
}

function getProcessControlFlow(
  node: FlowEditorNode,
): FlowProcessControlFlow | undefined {
  return "instruction" in node.data.config
    ? node.data.config.controlFlow
    : undefined;
}

function isControlInstruction(
  node: FlowEditorNode,
  instruction: "break" | "continue",
) {
  return getProcessInstruction(node).trim().replace(/;$/, "") === instruction;
}

function getFunctionParametersForCode(flowFunction: FlowFunctionDefinition) {
  const definitions =
    flowFunction.parameterDefinitions?.length
      ? flowFunction.parameterDefinitions
      : flowFunction.parameters.map(parameterTextToDefinition);

  return definitions.map(formatFunctionParameter);
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

function formatFunctionParameter(parameter: FlowFunctionParameterDefinition) {
  const name = toSafeIdentifier(parameter.name, "parametro");

  if (parameter.rest) {
    return `...${name}`;
  }

  if (parameter.defaultValue !== undefined) {
    return `${name} = ${parameter.defaultValue}`;
  }

  return name;
}

function getNodeDescription(node: FlowEditorNode) {
  const label = node.data.label.trim();

  return label || `${node.type} ${node.id}`;
}

function getEdgeKey(edge: FlowConnectionLike) {
  return (
    edge.id ??
    `${edge.source}:${edge.sourceHandle ?? ""}:${edge.target}:${
      edge.targetHandle ?? ""
    }`
  );
}

function addLine(context: RenderContext, line: string) {
  context.lines.push(`${indent.repeat(context.indentLevel)}${line}`);
}
