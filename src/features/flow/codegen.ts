import {
  createFlowGraph,
  getOutgoingEdges,
  getOutgoingEdgesByHandle,
  type FlowConnectionLike,
  type FlowGraph,
} from "@/features/flow/flow-graph";
import type { FlowEditorEdge, FlowEditorNode } from "@/types/flow";

type DecisionBranchHandle = "yes" | "no";

type GenerateJavaScriptInput = {
  nodes: FlowEditorNode[];
  edges: FlowEditorEdge[];
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
};

const indent = "  ";
const decisionBranches: DecisionBranchHandle[] = ["yes", "no"];

export function generateJavaScriptFromFlow({
  nodes,
  edges,
}: GenerateJavaScriptInput): FlowCodeGenerationResult {
  const graph = createFlowGraph(nodes, edges);
  const startNodes = nodes.filter((node) => node.type === "start");
  const warnings: string[] = [];

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

  const lines = ["// Código generado desde FlowCode"];
  const backwardLoopByTargetId = findBackwardLoops(graph, startNode.id);
  const startEdge = getFirstOutgoingEdge(graph, startNode.id);

  if (!startEdge) {
    warnings.push("El bloque Inicio no tiene una conexión de salida.");
    lines.push("// El programa aún no tiene instrucciones conectadas.");
  } else {
    renderSequence(startEdge.target, {
      graph,
      warnings,
      lines,
      activePath: new Set(),
      emittedNodeIds: new Set(),
      backwardLoopByTargetId,
      indentLevel: 0,
    });
  }

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
      context.emittedNodeIds.add(node.id);
      addLine(context, formatInstruction(getProcessInstruction(node)));
      renderSequence(getFirstOutgoingEdge(context.graph, node.id)?.target, {
        ...context,
        activePath: new Set(context.activePath),
      });
      return;
    }

    if (node.type === "decision") {
      context.emittedNodeIds.add(node.id);
      renderDecision(node, context);
    }
  } finally {
    context.activePath.delete(node.id);
  }
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

  addLine(
    context,
    `while (${formatLoopCondition(loopInfo.condition, loopInfo.loopBranch)}) {`,
  );
  renderSequence(loopInfo.targetNodeId, {
    ...context,
    activePath: new Set(context.activePath),
    indentLevel: context.indentLevel + 1,
    stopNodeId: loopInfo.decisionNodeId,
    disabledLoopTargetId: loopInfo.targetNodeId,
  });
  addLine(context, "}");

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
    context.warnings.push(
      `El ciclo de "${getNodeDescription(decisionNode)}" no tiene rama de salida.`,
    );
  }
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

function getProcessInstruction(node: FlowEditorNode) {
  return "instruction" in node.data.config ? node.data.config.instruction : "";
}

function getDecisionCondition(node: FlowEditorNode) {
  const condition =
    "condition" in node.data.config ? node.data.config.condition.trim() : "";

  return condition || "true";
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
