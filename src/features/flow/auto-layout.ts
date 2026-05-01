import type { XYPosition } from "@xyflow/react";
import { getDefaultFlowNodeHandlePositions } from "@/features/flow/handle-positions";
import type {
  FlowHandlePosition,
  FlowNodeConfig,
  FlowNodeHandleId,
  FlowNodeHandlePositions,
  FlowNodeType,
} from "@/types/flow";

type AutoLayoutNodeData = {
  label: string;
  config: FlowNodeConfig;
  handlePositions?: FlowNodeHandlePositions;
};

export type AutoLayoutNode = {
  id: string;
  type: FlowNodeType;
  position: XYPosition;
  data: AutoLayoutNodeData;
  height?: number;
  measured?: {
    width?: number;
    height?: number;
  };
  width?: number;
};

export type AutoLayoutEdge = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

type LayoutGraph<TNode extends AutoLayoutNode, TEdge extends AutoLayoutEdge> = {
  edges: TEdge[];
  incomingByTarget: Map<string, TEdge[]>;
  nodeById: Map<string, TNode>;
  nodeOrder: Map<string, number>;
  nodes: TNode[];
  outgoingBySource: Map<string, TEdge[]>;
  outgoingBySourceHandle: Map<string, Map<string, TEdge[]>>;
};

type NodeSize = {
  width: number;
  height: number;
};

type CenterPoint = {
  x: number;
  y: number;
};

type LayoutBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

type SequenceLayoutResult = {
  bounds: LayoutBounds;
  nextY: number;
};

type StructureLayoutResult = {
  bounds: LayoutBounds;
  nextId?: string;
  nextX: number;
  nextY: number;
};

type LayoutContext<TNode extends AutoLayoutNode, TEdge extends AutoLayoutEdge> = {
  doWhileConditionByBodyEntryId: Map<string, string>;
  forcedHandlesByNodeId: Map<string, FlowNodeHandlePositions>;
  graph: LayoutGraph<TNode, TEdge>;
  placedNodeIds: Set<string>;
  placements: Map<string, CenterPoint>;
};

type SwitchLayoutMode = "branching" | "returning";

// Change this value to tune the minimum visual gap between any two blocks.
export const autoLayoutMinimumBlockGap = 72;

// Connected blocks closer than this are snapped onto the same visual axis.
export const autoLayoutSnapAlignmentDistance = 48;

// Sequences shorter than this stay as a straight line instead of being packed.
export const autoLayoutLinearPackThreshold = 5;

const layoutSpacing = {
  branchGapX: 330,
  branchGapY: 185,
  caseBodyGapX: 360,
  caseNodeGapX: 285,
  caseRowGapY: 230,
  compactRowGapX: 285,
  compactRowGapY: 148,
  defaultOriginX: 360,
  defaultOriginY: 64,
  diagonalDecisionGapX: 235,
  diagonalDecisionGapY: 135,
  joinGapY: 145,
  loopBodyGapX: 390,
  loopExitGapX: 360,
  loopGapY: 175,
  minimumBlockGap: autoLayoutMinimumBlockGap,
  nodeGapY: 118,
  orphanGapX: 420,
  orphanGapY: 190,
  snapAlignmentDistance: autoLayoutSnapAlignmentDistance,
  switchExitGapX: 520,
  switchExitGapY: 190,
} as const;

const baseNodeSizes: Record<FlowNodeType, NodeSize> = {
  decision: { width: 210, height: 146 },
  end: { width: 160, height: 48 },
  functionCall: { width: 230, height: 92 },
  input: { width: 250, height: 118 },
  output: { width: 313, height: 135 },
  process: { width: 210, height: 66 },
  return: { width: 210, height: 58 },
  start: { width: 160, height: 48 },
};

const flowHandleIds = new Set<string>(["in", "out", "yes", "no"]);

export function applySmartFlowLayout<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>({
  edges,
  nodes,
}: {
  edges: TEdge[];
  nodes: TNode[];
}) {
  if (nodes.length === 0) {
    return {
      edges,
      nodes,
    };
  }

  const graph = createLayoutGraph(nodes, edges);
  const context: LayoutContext<TNode, TEdge> = {
    doWhileConditionByBodyEntryId: getDoWhileConditionByBodyEntryId(graph),
    forcedHandlesByNodeId: new Map(),
    graph,
    placedNodeIds: new Set(),
    placements: new Map(),
  };
  const entryNodeId = getDiagramEntryNodeId(graph);

  if (entryNodeId) {
    layoutSequence(context, {
      startId: entryNodeId,
      stopIds: new Set(),
      x: layoutSpacing.defaultOriginX,
      y: layoutSpacing.defaultOriginY,
    });
  }

  placeUnreachableNodes(context);
  resolveMinimumBlockSpacing(context);
  snapNearbyConnectedBlocks(context);
  resolveMinimumBlockSpacing(context);
  snapNearbyConnectedBlocks(context);

  const nodesWithPositions = nodes.map((node) => {
    const center = context.placements.get(node.id) ?? {
      x: node.position.x + getNodeSize(node).width / 2,
      y: node.position.y + getNodeSize(node).height / 2,
    };
    const size = getNodeSize(node);

    return {
      ...node,
      position: {
        x: roundLayoutValue(center.x - size.width / 2),
        y: roundLayoutValue(center.y - size.height / 2),
      },
    };
  });
  const handlePositionsByNodeId = getHandlePositionsByNodeId({
    edges,
    forcedHandlesByNodeId: context.forcedHandlesByNodeId,
    nodes: nodesWithPositions,
    placements: context.placements,
  });

  return {
    edges,
    nodes: nodesWithPositions.map((node) => ({
      ...node,
      data: {
        ...node.data,
        handlePositions: handlePositionsByNodeId.get(node.id),
      },
    })),
  };
}

function layoutSequence<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    startId,
    stopIds,
    x,
    y,
    ignoredDoWhileEntryIds = new Set(),
  }: {
    ignoredDoWhileEntryIds?: Set<string>;
    startId: string | undefined;
    stopIds: Set<string>;
    x: number;
    y: number;
  },
): SequenceLayoutResult {
  let currentId = startId;
  let currentX = x;
  let currentY = y;
  let bounds = createEmptyBounds();
  let guard = 0;

  while (
    currentId &&
    !stopIds.has(currentId) &&
    guard < context.graph.nodes.length * 4
  ) {
    guard += 1;

    const node = context.graph.nodeById.get(currentId);

    if (!node || context.placedNodeIds.has(currentId)) {
      break;
    }

    const doWhileConditionId = ignoredDoWhileEntryIds.has(currentId)
      ? undefined
      : context.doWhileConditionByBodyEntryId.get(currentId);

    if (doWhileConditionId) {
      const result = layoutDoWhileStructure(context, {
        bodyEntryId: currentId,
        conditionId: doWhileConditionId,
        stopIds,
        x: currentX,
        y: currentY,
      });

      bounds = mergeBounds(bounds, result.bounds);
      currentId = result.nextId;
      currentX = result.nextX;
      currentY = result.nextY;
      continue;
    }

    if (isPackableLinearNode(node)) {
      const packedRun = getPackableLinearRun(context, currentId, stopIds);

      if (packedRun.length >= autoLayoutLinearPackThreshold) {
        const packedRunNextId = getLinearSuccessorId(
          context.graph,
          packedRun[packedRun.length - 1],
        );
        const result = layoutPackedLinearRun(context, {
          direction: getPackedRunDirection(context, packedRunNextId),
          nodeIds: packedRun,
          x: currentX,
          y: currentY,
        });

        bounds = mergeBounds(bounds, result.bounds);
        currentId = packedRunNextId;
        currentX = getPackedRunContinuationX(context, {
          fallbackX: currentX,
          lastNodeId: packedRun[packedRun.length - 1],
          nextNodeId: currentId,
          placedX: result.lastX,
        });
        currentY = result.nextY;
        continue;
      }
    }

    if (node.type === "decision") {
      const controlFlowKind = getDecisionControlFlowKind(node);
      const result =
        controlFlowKind === "switch"
          ? layoutSwitchStructure(context, {
              node,
              stopIds,
              x: currentX,
              y: currentY,
            })
          : controlFlowKind === "for" || isWhileDecision(context, node)
            ? layoutLoopStructure(context, {
                node,
                stopIds,
                x: currentX,
                y: currentY,
              })
            : layoutIfStructure(context, {
                node,
                stopIds,
                x: currentX,
                y: currentY,
              });

      bounds = mergeBounds(bounds, result.bounds);
      currentId = result.nextId;
      currentX = result.nextX;
      currentY = result.nextY;
      continue;
    }

    const nodeBounds = placeNode(context, currentId, currentX, currentY);

    bounds = mergeBounds(bounds, nodeBounds);
    currentId = getLinearSuccessorId(context.graph, currentId);
    currentY += getNodeSize(node).height + layoutSpacing.nodeGapY;
  }

  return {
    bounds,
    nextY: currentY,
  };
}

function layoutPackedLinearRun<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    direction,
    nodeIds,
    x,
    y,
  }: {
    direction: -1 | 1;
    nodeIds: string[];
    x: number;
    y: number;
  },
) {
  const rowCount = Math.ceil(nodeIds.length / 3);
  let bounds = createEmptyBounds();
  let lastX = x;

  for (let index = 0; index < nodeIds.length; index += 1) {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const isOddRow = row % 2 === 1;
    const columnOffset = isOddRow ? 2 - column : column;
    const nodeX = x + direction * columnOffset * layoutSpacing.compactRowGapX;
    const nodeY = y + row * layoutSpacing.compactRowGapY;

    bounds = mergeBounds(bounds, placeNode(context, nodeIds[index], nodeX, nodeY));
    lastX = nodeX;
  }

  return {
    bounds,
    lastX,
    nextY: y + rowCount * layoutSpacing.compactRowGapY + 10,
  };
}

function layoutIfStructure<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    node,
    stopIds,
    x,
    y,
  }: {
    node: TNode;
    stopIds: Set<string>;
    x: number;
    y: number;
  },
): StructureLayoutResult {
  forceNodeHandles(context, node.id, {
    in: "top",
    no: "right",
    yes: "left",
  });

  let bounds = placeNode(context, node.id, x, y);
  const yesTargetId = getTargetByHandle(context.graph, node.id, "yes");
  const noTargetId = getTargetByHandle(context.graph, node.id, "no");
  const joinId = findBranchJoin(context.graph, {
    branchTargetIds: [yesTargetId, noTargetId],
    blockedIds: new Set([node.id, ...stopIds]),
  });
  const branchStopIds = new Set(stopIds);

  if (joinId) {
    branchStopIds.add(joinId);
  }

  const branchY = y + layoutSpacing.branchGapY;
  const yesResult = yesTargetId
    ? layoutSequence(context, {
        startId: yesTargetId,
        stopIds: branchStopIds,
        x: x - layoutSpacing.branchGapX,
        y: branchY,
      })
    : null;
  const noResult =
    noTargetId && noTargetId !== joinId
      ? layoutSequence(context, {
          startId: noTargetId,
          stopIds: branchStopIds,
          x: x + layoutSpacing.branchGapX,
          y: branchY,
        })
      : null;

  if (yesResult) {
    bounds = mergeBounds(bounds, yesResult.bounds);
  }

  if (noResult) {
    bounds = mergeBounds(bounds, noResult.bounds);
  }

  return {
    bounds,
    nextId: joinId,
    nextX: x,
    nextY: Math.max(
      y + getNodeSize(node).height + layoutSpacing.joinGapY,
      yesResult?.nextY ?? branchY,
      noResult?.nextY ?? branchY,
    ),
  };
}

function layoutLoopStructure<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    node,
    stopIds,
    x,
    y,
  }: {
    node: TNode;
    stopIds: Set<string>;
    x: number;
    y: number;
  },
): StructureLayoutResult {
  forceNodeHandles(context, node.id, {
    in: "top",
    no: "right",
    yes: "left",
  });

  let bounds = placeNode(context, node.id, x, y);
  const yesTargetId = getTargetByHandle(context.graph, node.id, "yes");
  const noTargetId = getTargetByHandle(context.graph, node.id, "no");
  const controlFlow = getDecisionControlFlow(node);
  const updateNodeId =
    controlFlow?.kind === "for" ? controlFlow.updateNodeId : undefined;
  const loopUpdateNodeId =
    updateNodeId ?? inferLoopUpdateNodeId(context.graph, yesTargetId, node.id);
  const loopStopIds = new Set(stopIds);

  loopStopIds.add(node.id);

  if (loopUpdateNodeId) {
    loopStopIds.add(loopUpdateNodeId);
  }

  const bodyX = x - layoutSpacing.loopBodyGapX;
  const bodyY = y + 48;
  const bodyResult =
    yesTargetId && yesTargetId !== loopUpdateNodeId
      ? layoutSequence(context, {
          startId: yesTargetId,
          stopIds: loopStopIds,
          x: bodyX,
          y: bodyY,
        })
      : null;

  if (bodyResult) {
    bounds = mergeBounds(bounds, bodyResult.bounds);
  }

  if (loopUpdateNodeId && context.graph.nodeById.has(loopUpdateNodeId)) {
    const updateY =
      bodyResult && !isBoundsEmpty(bodyResult.bounds)
        ? Math.max(bodyY - 112, bodyResult.bounds.minY - 82)
        : y + layoutSpacing.loopGapY;

    bounds = mergeBounds(
      bounds,
      placeNode(context, loopUpdateNodeId, bodyX, updateY),
    );
  }

  return {
    bounds,
    nextId: noTargetId,
    nextX: x + layoutSpacing.loopExitGapX,
    nextY: Math.max(
      y + layoutSpacing.loopGapY,
      bodyResult?.nextY ?? y + layoutSpacing.loopGapY,
    ),
  };
}

function layoutDoWhileStructure<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    bodyEntryId,
    conditionId,
    stopIds,
    x,
    y,
  }: {
    bodyEntryId: string;
    conditionId: string;
    stopIds: Set<string>;
    x: number;
    y: number;
  },
): StructureLayoutResult {
  const conditionNode = context.graph.nodeById.get(conditionId);
  const loopStopIds = new Set(stopIds);

  loopStopIds.add(conditionId);

  const bodyResult = layoutSequence(context, {
        startId: bodyEntryId,
        stopIds: loopStopIds,
        x,
        y,
        ignoredDoWhileEntryIds: new Set([bodyEntryId]),
      });
  const bodyBounds = bodyResult.bounds;
  const conditionX = x - layoutSpacing.loopBodyGapX;
  const conditionY = isBoundsEmpty(bodyBounds)
    ? y + layoutSpacing.loopGapY
    : Math.max(y + layoutSpacing.branchGapY, bodyBounds.minY + 120);
  let bounds = bodyResult.bounds;

  if (conditionNode) {
    forceNodeHandles(context, conditionId, {
      in: "right",
      no: "bottom",
      yes: "left",
    });
    bounds = mergeBounds(bounds, placeNode(context, conditionId, conditionX, conditionY));
  }

  return {
    bounds,
    nextId: conditionNode
      ? getTargetByHandle(context.graph, conditionId, "no")
      : undefined,
    nextX: conditionX,
    nextY: conditionY + layoutSpacing.loopGapY,
  };
}

function layoutSwitchStructure<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    node,
    stopIds,
    x,
    y,
  }: {
    node: TNode;
    stopIds: Set<string>;
    x: number;
    y: number;
  },
): StructureLayoutResult {
  const switchInfo = getSwitchInfo(context.graph, node);

  if (switchInfo.mode === "returning") {
    return layoutReturningSwitch(context, {
      node,
      stopIds,
      switchInfo,
      x,
      y,
    });
  }

  return layoutBranchingSwitch(context, {
    node,
    stopIds,
    switchInfo,
    x,
    y,
  });
}

function layoutBranchingSwitch<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    node,
    stopIds,
    switchInfo,
    x,
    y,
  }: {
    node: TNode;
    stopIds: Set<string>;
    switchInfo: ReturnType<typeof getSwitchInfo<TNode, TEdge>>;
    x: number;
    y: number;
  },
): StructureLayoutResult {
  let bounds = createEmptyBounds();
  const decisionIds = switchInfo.decisionIds.length > 0
    ? switchInfo.decisionIds
    : [node.id];
  const bodyStopIds = new Set([...stopIds, ...decisionIds]);
  const joinId = switchInfo.joinId;

  if (joinId) {
    bodyStopIds.add(joinId);
  }

  for (const [index, decisionId] of decisionIds.entries()) {
    const decisionY = y + index * layoutSpacing.caseRowGapY;

    forceNodeHandles(context, decisionId, {
      in: "top",
      no: index === decisionIds.length - 1 ? "right" : "bottom",
      yes: "right",
    });
    bounds = mergeBounds(bounds, placeNode(context, decisionId, x, decisionY));

    const bodyEntryId =
      switchInfo.caseEntryByDecisionId.get(decisionId) ??
      getTargetByHandle(context.graph, decisionId, "yes");

    if (bodyEntryId && bodyEntryId !== joinId) {
      bounds = mergeBounds(
        bounds,
        layoutCaseBody(context, {
          startId: bodyEntryId,
          stopIds: bodyStopIds,
          x: x + layoutSpacing.caseBodyGapX,
          y: decisionY,
        }),
      );
    }
  }

  const defaultEntryId = switchInfo.defaultEntryId;

  if (defaultEntryId && defaultEntryId !== joinId) {
    bounds = mergeBounds(
      bounds,
      layoutCaseBody(context, {
        startId: defaultEntryId,
        stopIds: bodyStopIds,
        x: x + layoutSpacing.caseBodyGapX,
        y: y + decisionIds.length * layoutSpacing.caseRowGapY,
      }),
    );
  }

  return {
    bounds,
    nextId: joinId,
    nextX: getSwitchExitX(context, {
      fallbackX: x + layoutSpacing.switchExitGapX,
      joinId,
      switchBounds: bounds,
    }),
    nextY: isBoundsEmpty(bounds)
      ? y + layoutSpacing.switchExitGapY
      : bounds.maxY + layoutSpacing.switchExitGapY,
  };
}

function layoutReturningSwitch<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    node,
    stopIds,
    switchInfo,
    x,
    y,
  }: {
    node: TNode;
    stopIds: Set<string>;
    switchInfo: ReturnType<typeof getSwitchInfo<TNode, TEdge>>;
    x: number;
    y: number;
  },
): StructureLayoutResult {
  let bounds = createEmptyBounds();
  const decisionIds = switchInfo.decisionIds.length > 0
    ? switchInfo.decisionIds
    : [node.id];
  const bodyStopIds = new Set([...stopIds, ...decisionIds]);

  for (const [index, decisionId] of decisionIds.entries()) {
    const decisionX = x + index * layoutSpacing.diagonalDecisionGapX;
    const decisionY = y + index * layoutSpacing.diagonalDecisionGapY;
    const bodyEntryId =
      switchInfo.caseEntryByDecisionId.get(decisionId) ??
      getTargetByHandle(context.graph, decisionId, "yes");

    forceNodeHandles(context, decisionId, {
      in: "top",
      no: "right",
      yes: "left",
    });
    bounds = mergeBounds(bounds, placeNode(context, decisionId, decisionX, decisionY));

    if (bodyEntryId) {
      bounds = mergeBounds(
        bounds,
        layoutSequence(context, {
          startId: bodyEntryId,
          stopIds: bodyStopIds,
          x: decisionX - layoutSpacing.caseNodeGapX,
          y: decisionY + layoutSpacing.branchGapY,
        }).bounds,
      );
    }
  }

  if (switchInfo.defaultEntryId) {
    const defaultIndex = decisionIds.length - 1;

    bounds = mergeBounds(
      bounds,
      layoutSequence(context, {
        startId: switchInfo.defaultEntryId,
        stopIds: bodyStopIds,
        x:
          x +
          defaultIndex * layoutSpacing.diagonalDecisionGapX +
          layoutSpacing.caseNodeGapX,
        y: y + defaultIndex * layoutSpacing.diagonalDecisionGapY + 95,
      }).bounds,
    );
  }

  return {
    bounds,
    nextX: x,
    nextY: isBoundsEmpty(bounds) ? y : bounds.maxY + layoutSpacing.joinGapY,
  };
}

function layoutCaseBody<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    startId,
    stopIds,
    x,
    y,
  }: {
    startId: string;
    stopIds: Set<string>;
    x: number;
    y: number;
  },
) {
  let currentId: string | undefined = startId;
  let currentX = x;
  let bounds = createEmptyBounds();
  let guard = 0;

  while (
    currentId &&
    !stopIds.has(currentId) &&
    !context.placedNodeIds.has(currentId) &&
    guard < context.graph.nodes.length
  ) {
    guard += 1;
    const node = context.graph.nodeById.get(currentId);

    if (node?.type === "process" || node?.type === "output") {
      forceNodeHandles(context, currentId, {
        in: "left",
        out: "right",
      });
    }

    bounds = mergeBounds(bounds, placeNode(context, currentId, currentX, y));
    currentId = getLinearSuccessorId(context.graph, currentId);
    currentX += layoutSpacing.caseNodeGapX;
  }

  return bounds;
}

function placeUnreachableNodes<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(context: LayoutContext<TNode, TEdge>) {
  const currentBounds = getPlacedBounds(context);
  const startX = isBoundsEmpty(currentBounds)
    ? layoutSpacing.defaultOriginX
    : currentBounds.maxX + layoutSpacing.orphanGapX;
  let y = layoutSpacing.defaultOriginY;

  for (const node of context.graph.nodes) {
    if (context.placedNodeIds.has(node.id)) {
      continue;
    }

    placeNode(context, node.id, startX, y);
    y += getNodeSize(node).height + layoutSpacing.orphanGapY;
  }
}

function resolveMinimumBlockSpacing<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(context: LayoutContext<TNode, TEdge>) {
  const placedNodeIds = Array.from(context.placements.keys()).sort(
    (left, right) =>
      (context.graph.nodeOrder.get(left) ?? 0) -
      (context.graph.nodeOrder.get(right) ?? 0),
  );
  const maxIterations = Math.max(1, placedNodeIds.length * 6);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;

    for (let anchorIndex = 0; anchorIndex < placedNodeIds.length; anchorIndex += 1) {
      const anchorId = placedNodeIds[anchorIndex];
      const anchorNode = context.graph.nodeById.get(anchorId);
      const anchorCenter = context.placements.get(anchorId);

      if (!anchorNode || !anchorCenter) {
        continue;
      }

      for (
        let movableIndex = anchorIndex + 1;
        movableIndex < placedNodeIds.length;
        movableIndex += 1
      ) {
        const movableId = placedNodeIds[movableIndex];
        const movableNode = context.graph.nodeById.get(movableId);
        const movableCenter = context.placements.get(movableId);

        if (!movableNode || !movableCenter) {
          continue;
        }

        const adjustment = getMinimumBlockSpacingAdjustment({
          anchorBounds: getNodeBounds(anchorNode, anchorCenter),
          anchorCenter,
          movableBounds: getNodeBounds(movableNode, movableCenter),
          movableCenter,
        });

        if (!adjustment) {
          continue;
        }

        context.placements.set(movableId, {
          x:
            movableCenter.x +
            (adjustment.axis === "x" ? adjustment.amount : 0),
          y:
            movableCenter.y +
            (adjustment.axis === "y" ? adjustment.amount : 0),
        });
        changed = true;
      }
    }

    if (!changed) {
      return;
    }
  }
}

function snapNearbyConnectedBlocks<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(context: LayoutContext<TNode, TEdge>) {
  const sortedEdges = [...context.graph.edges].sort(
    (left, right) =>
      (context.graph.nodeOrder.get(left.source) ?? 0) -
      (context.graph.nodeOrder.get(right.source) ?? 0),
  );
  const maxIterations = Math.max(1, sortedEdges.length * 2);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;

    for (const edge of sortedEdges) {
      const adjustment = getNearbyConnectedBlockSnapAdjustment(context, edge);

      if (!adjustment) {
        continue;
      }

      const targetCenter = context.placements.get(edge.target);

      if (!targetCenter) {
        continue;
      }

      context.placements.set(edge.target, {
        x:
          targetCenter.x +
          (adjustment.axis === "x" ? adjustment.amount : 0),
        y:
          targetCenter.y +
          (adjustment.axis === "y" ? adjustment.amount : 0),
      });
      changed = true;
    }

    if (!changed) {
      return;
    }
  }
}

function getNearbyConnectedBlockSnapAdjustment<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(context: LayoutContext<TNode, TEdge>, edge: TEdge) {
  if (!canSnapConnectedBlocks(context, edge)) {
    return null;
  }

  const sourceNode = context.graph.nodeById.get(edge.source);
  const targetNode = context.graph.nodeById.get(edge.target);
  const sourceCenter = sourceNode
    ? context.placements.get(sourceNode.id)
    : undefined;
  const targetCenter = targetNode
    ? context.placements.get(targetNode.id)
    : undefined;

  if (!sourceNode || !targetNode || !sourceCenter || !targetCenter) {
    return null;
  }

  const { sourceSide, targetSide } = getPredictedEdgeHandleSides({
    context,
    edge,
    sourceCenter,
    sourceNode,
    targetCenter,
    targetNode,
  });
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const isVerticalConnection =
    (sourceSide === "bottom" && targetSide === "top") ||
    (sourceSide === "top" && targetSide === "bottom");
  const isHorizontalConnection =
    (sourceSide === "right" && targetSide === "left") ||
    (sourceSide === "left" && targetSide === "right");

  if (
    isVerticalConnection &&
    Math.abs(dx) > 0.5 &&
    Math.abs(dx) <= layoutSpacing.snapAlignmentDistance
  ) {
    return {
      amount: -dx,
      axis: "x" as const,
    };
  }

  if (
    isHorizontalConnection &&
    Math.abs(dy) > 0.5 &&
    Math.abs(dy) <= layoutSpacing.snapAlignmentDistance
  ) {
    return {
      amount: -dy,
      axis: "y" as const,
    };
  }

  return null;
}

function canSnapConnectedBlocks<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(context: LayoutContext<TNode, TEdge>, edge: TEdge) {
  const sourceOrder = context.graph.nodeOrder.get(edge.source);
  const targetOrder = context.graph.nodeOrder.get(edge.target);
  const targetIncomingCount =
    context.graph.incomingByTarget.get(edge.target)?.length ?? 0;

  return (
    sourceOrder !== undefined &&
    targetOrder !== undefined &&
    targetOrder > sourceOrder &&
    targetIncomingCount <= 1
  );
}

function getPredictedEdgeHandleSides<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>({
  context,
  edge,
  sourceCenter,
  sourceNode,
  targetCenter,
  targetNode,
}: {
  context: LayoutContext<TNode, TEdge>;
  edge: TEdge;
  sourceCenter: CenterPoint;
  sourceNode: TNode;
  targetCenter: CenterPoint;
  targetNode: TNode;
}) {
  const sourceHandle = getFlowHandleId(edge.sourceHandle ?? "out");
  const targetHandle = getFlowHandleId(edge.targetHandle ?? "in");
  const sourceSideFromGeometry = getDominantSide(
    targetCenter.x - sourceCenter.x,
    targetCenter.y - sourceCenter.y,
  );
  const targetSideFromGeometry = getOppositeSide(sourceSideFromGeometry);
  const sourceSide =
    (sourceHandle
      ? context.forcedHandlesByNodeId.get(sourceNode.id)?.[sourceHandle]
      : undefined) ??
    (sourceHandle &&
    shouldUseEdgeAwareSourceHandle(sourceNode, targetNode)
      ? sourceSideFromGeometry
      : getDefaultFlowNodeHandlePositions(sourceNode.type)[
          sourceHandle ?? "out"
        ]) ??
    sourceSideFromGeometry;
  const targetSide =
    (targetHandle
      ? context.forcedHandlesByNodeId.get(targetNode.id)?.[targetHandle]
      : undefined) ??
    (targetHandle &&
    shouldUseEdgeAwareTargetHandle(targetNode, targetSideFromGeometry)
      ? targetSideFromGeometry
      : getDefaultFlowNodeHandlePositions(targetNode.type)[
          targetHandle ?? "in"
        ]) ??
    targetSideFromGeometry;

  return {
    sourceSide,
    targetSide,
  };
}

function getMinimumBlockSpacingAdjustment({
  anchorBounds,
  anchorCenter,
  movableBounds,
  movableCenter,
}: {
  anchorBounds: LayoutBounds;
  anchorCenter: CenterPoint;
  movableBounds: LayoutBounds;
  movableCenter: CenterPoint;
}) {
  const gap = layoutSpacing.minimumBlockGap;
  const expandedAnchorBounds = padBounds(anchorBounds, gap / 2);
  const expandedMovableBounds = padBounds(movableBounds, gap / 2);
  const overlapX = Math.min(
    expandedAnchorBounds.maxX,
    expandedMovableBounds.maxX,
  ) - Math.max(expandedAnchorBounds.minX, expandedMovableBounds.minX);
  const overlapY = Math.min(
    expandedAnchorBounds.maxY,
    expandedMovableBounds.maxY,
  ) - Math.max(expandedAnchorBounds.minY, expandedMovableBounds.minY);

  if (overlapX <= 0 || overlapY <= 0) {
    return null;
  }

  const dx = movableCenter.x - anchorCenter.x;
  const dy = movableCenter.y - anchorCenter.y;
  const axis =
    Math.abs(dx) > Math.abs(dy) * 1.15
      ? "x"
      : Math.abs(dy) > Math.abs(dx) * 1.15
        ? "y"
        : overlapX <= overlapY
          ? "x"
          : "y";
  const direction =
    axis === "x"
      ? dx >= 0
        ? 1
        : -1
      : dy >= 0
        ? 1
        : -1;

  return {
    amount: direction * (axis === "x" ? overlapX + 1 : overlapY + 1),
    axis,
  };
}

function padBounds(bounds: LayoutBounds, padding: number): LayoutBounds {
  return {
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
  };
}

function placeNode<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  nodeId: string,
  x: number,
  y: number,
) {
  const node = context.graph.nodeById.get(nodeId);

  if (!node) {
    return createEmptyBounds();
  }

  if (!context.placements.has(nodeId)) {
    context.placements.set(nodeId, {
      x: roundLayoutValue(x),
      y: roundLayoutValue(y),
    });
    context.placedNodeIds.add(nodeId);
  }

  return getNodeBounds(node, context.placements.get(nodeId) ?? { x, y });
}

function createLayoutGraph<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(nodes: TNode[], edges: TEdge[]): LayoutGraph<TNode, TEdge> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incomingByTarget = new Map<string, TEdge[]>();
  const outgoingBySource = new Map<string, TEdge[]>();
  const outgoingBySourceHandle = new Map<string, Map<string, TEdge[]>>();
  const nodeOrder = new Map<string, number>();

  for (const [index, node] of nodes.entries()) {
    incomingByTarget.set(node.id, []);
    outgoingBySource.set(node.id, []);
    outgoingBySourceHandle.set(node.id, new Map());
    nodeOrder.set(node.id, index);
  }

  for (const edge of edges) {
    incomingByTarget.get(edge.target)?.push(edge);
    outgoingBySource.get(edge.source)?.push(edge);

    const sourceHandle = edge.sourceHandle ?? "out";
    const handleEdgesById = outgoingBySourceHandle.get(edge.source);
    const handleEdges = handleEdgesById?.get(sourceHandle) ?? [];

    handleEdges.push(edge);
    handleEdgesById?.set(sourceHandle, handleEdges);
  }

  return {
    edges,
    incomingByTarget,
    nodeById,
    nodeOrder,
    nodes,
    outgoingBySource,
    outgoingBySourceHandle,
  };
}

function getDiagramEntryNodeId<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(graph: LayoutGraph<TNode, TEdge>) {
  return (
    graph.nodes.find((node) => node.type === "start")?.id ??
    graph.nodes.find((node) => (graph.incomingByTarget.get(node.id) ?? []).length === 0)
      ?.id ??
    graph.nodes[0]?.id
  );
}

function getDoWhileConditionByBodyEntryId<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(graph: LayoutGraph<TNode, TEdge>) {
  const result = new Map<string, string>();

  for (const node of graph.nodes) {
    const controlFlow = getDecisionControlFlow(node);

    if (controlFlow?.kind === "doWhile" && controlFlow.bodyEntryId) {
      result.set(controlFlow.bodyEntryId, node.id);
    }
  }

  return result;
}

function getPackableLinearRun<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  startId: string,
  stopIds: Set<string>,
) {
  const result: string[] = [];
  let currentId: string | undefined = startId;
  let guard = 0;

  while (
    currentId &&
    !stopIds.has(currentId) &&
    !context.placedNodeIds.has(currentId) &&
    guard < context.graph.nodes.length
  ) {
    guard += 1;

    const node = context.graph.nodeById.get(currentId);

    if (!node || !isPackableLinearNode(node)) {
      break;
    }

    result.push(currentId);
    currentId = getLinearSuccessorId(context.graph, currentId);
  }

  return result;
}

function isPackableLinearNode(node: AutoLayoutNode) {
  if (node.type !== "process") {
    return false;
  }

  const controlFlow =
    "instruction" in node.data.config
      ? node.data.config.controlFlow
      : undefined;

  return !controlFlow;
}

function getPackedRunContinuationX<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    fallbackX,
    lastNodeId,
    nextNodeId,
    placedX,
  }: {
    fallbackX: number;
    lastNodeId: string;
    nextNodeId?: string;
    placedX: number;
  },
) {
  const nextNode = nextNodeId ? context.graph.nodeById.get(nextNodeId) : null;

  if (!nextNode) {
    return placedX;
  }

  if (context.doWhileConditionByBodyEntryId.has(nextNode.id)) {
    return placedX;
  }

  if (nextNode.type === "functionCall") {
    return placedX;
  }

  if (
    nextNode.type === "decision" ||
    nextNode.type === "output" ||
    isLoopUpdateNode(context.graph.nodeById.get(lastNodeId))
  ) {
    return fallbackX;
  }

  return placedX;
}

function getPackedRunDirection<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  nextNodeId: string | undefined,
): -1 | 1 {
  const nextNode = nextNodeId ? context.graph.nodeById.get(nextNodeId) : null;

  if (nextNode?.type === "decision" && isWhileDecision(context, nextNode)) {
    return -1;
  }

  return 1;
}

function getLinearSuccessorId<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(graph: LayoutGraph<TNode, TEdge>, nodeId: string) {
  const outgoing = graph.outgoingBySource.get(nodeId) ?? [];

  if (outgoing.length !== 1) {
    return undefined;
  }

  const edge = outgoing[0];

  if (edge.sourceHandle === "yes" || edge.sourceHandle === "no") {
    return undefined;
  }

  return edge.target;
}

function getTargetByHandle<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  graph: LayoutGraph<TNode, TEdge>,
  nodeId: string,
  sourceHandle: string,
) {
  return graph.outgoingBySourceHandle.get(nodeId)?.get(sourceHandle)?.[0]?.target;
}

function isWhileDecision<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(context: LayoutContext<TNode, TEdge>, node: TNode) {
  if (node.type !== "decision" || getDecisionControlFlowKind(node)) {
    return false;
  }

  if (context.doWhileConditionByBodyEntryId.has(node.id)) {
    return false;
  }

  const yesTargetId = getTargetByHandle(context.graph, node.id, "yes");

  return Boolean(
    yesTargetId &&
      hasPath(context.graph, yesTargetId, node.id, new Set([node.id])),
  );
}

function inferLoopUpdateNodeId<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  graph: LayoutGraph<TNode, TEdge>,
  bodyEntryId: string | undefined,
  loopDecisionId: string,
) {
  if (!bodyEntryId) {
    return undefined;
  }

  const queue = [bodyEntryId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId || seen.has(nodeId) || nodeId === loopDecisionId) {
      continue;
    }

    seen.add(nodeId);

    const node = graph.nodeById.get(nodeId);
    const hasBackEdge = (graph.outgoingBySource.get(nodeId) ?? []).some(
      (edge) => edge.target === loopDecisionId,
    );

    if (
      hasBackEdge &&
      node?.type === "process" &&
      "instruction" in node.data.config
    ) {
      return nodeId;
    }

    for (const edge of graph.outgoingBySource.get(nodeId) ?? []) {
      if (edge.target !== loopDecisionId) {
        queue.push(edge.target);
      }
    }
  }

  return undefined;
}

function findBranchJoin<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  graph: LayoutGraph<TNode, TEdge>,
  {
    blockedIds,
    branchTargetIds,
  }: {
    blockedIds: Set<string>;
    branchTargetIds: Array<string | undefined>;
  },
) {
  const targets = branchTargetIds.filter((targetId): targetId is string =>
    Boolean(targetId),
  );

  if (targets.length < 2) {
    return undefined;
  }

  if (targets.every((targetId) => targetId === targets[0])) {
    return targets[0];
  }

  const reachability = targets.map((targetId) =>
    collectReachableNodes(graph, targetId, blockedIds),
  );
  const candidates = Array.from(reachability[0].keys()).filter((nodeId) =>
    reachability.every((reachableNodes) => reachableNodes.has(nodeId)),
  );

  if (candidates.length === 0) {
    return undefined;
  }

  candidates.sort((left, right) => {
    const leftScore = getJoinCandidateScore(graph, left, reachability);
    const rightScore = getJoinCandidateScore(graph, right, reachability);

    return leftScore - rightScore;
  });

  return candidates[0];
}

function getJoinCandidateScore<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  graph: LayoutGraph<TNode, TEdge>,
  nodeId: string,
  reachability: Array<Map<string, number>>,
) {
  const node = graph.nodeById.get(nodeId);
  const maxDistance = Math.max(
    ...reachability.map((reachableNodes) => reachableNodes.get(nodeId) ?? 0),
  );
  const incomingCount = graph.incomingByTarget.get(nodeId)?.length ?? 0;
  const joinBias = node?.type === "end" || incomingCount > 1 ? -0.35 : 0;

  return (
    maxDistance +
    joinBias +
    (graph.nodeOrder.get(nodeId) ?? graph.nodes.length) / 1000
  );
}

function collectReachableNodes<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  graph: LayoutGraph<TNode, TEdge>,
  startId: string,
  blockedIds: Set<string>,
) {
  const distances = new Map<string, number>();
  const queue: Array<{ distance: number; nodeId: string }> = [
    {
      distance: 0,
      nodeId: startId,
    },
  ];

  while (queue.length > 0) {
    const item = queue.shift();

    if (!item || blockedIds.has(item.nodeId) || distances.has(item.nodeId)) {
      continue;
    }

    distances.set(item.nodeId, item.distance);

    for (const edge of graph.outgoingBySource.get(item.nodeId) ?? []) {
      if (blockedIds.has(edge.target)) {
        continue;
      }

      queue.push({
        distance: item.distance + 1,
        nodeId: edge.target,
      });
    }
  }

  return distances;
}

function hasPath<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  graph: LayoutGraph<TNode, TEdge>,
  startId: string,
  targetId: string,
  seen: Set<string>,
) {
  if (startId === targetId) {
    return true;
  }

  if (seen.has(startId)) {
    return false;
  }

  seen.add(startId);

  for (const edge of graph.outgoingBySource.get(startId) ?? []) {
    if (hasPath(graph, edge.target, targetId, seen)) {
      return true;
    }
  }

  return false;
}

function getSwitchInfo<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(graph: LayoutGraph<TNode, TEdge>, rootNode: TNode) {
  const controlFlow = getDecisionControlFlow(rootNode);
  const switchMetadata =
    controlFlow?.kind === "switch" ? controlFlow : undefined;
  const decisionIds = uniqueIds(
    switchMetadata?.caseDecisionIds && switchMetadata.caseDecisionIds.length > 0
      ? switchMetadata.caseDecisionIds
      : [rootNode.id],
  ).filter((nodeId) => graph.nodeById.has(nodeId));
  const caseEntryByDecisionId = new Map<string, string>();
  const testCases = switchMetadata?.cases.filter((item) => item.test !== null) ?? [];
  const defaultEntryId = switchMetadata?.cases.find((item) => item.test === null)
    ?.entryId;

  for (const [index, decisionId] of decisionIds.entries()) {
    const caseEntryId =
      testCases[index]?.entryId ?? getTargetByHandle(graph, decisionId, "yes");

    if (caseEntryId) {
      caseEntryByDecisionId.set(decisionId, caseEntryId);
    }
  }

  const exitSourceIds = switchMetadata?.exitSources ?? [];
  const exitTargets = exitSourceIds
    .map((source) =>
      graph.outgoingBySourceHandle
        .get(source.sourceId)
        ?.get(source.sourceHandle)?.[0]?.target,
    )
    .filter((targetId): targetId is string => Boolean(targetId));
  const joinId = getCommonTarget(exitTargets);
  const mode: SwitchLayoutMode = isReturningSwitch(graph, {
    caseEntryByDecisionId,
    defaultEntryId,
    decisionIds,
    joinId,
  })
    ? "returning"
    : "branching";

  return {
    caseEntryByDecisionId,
    decisionIds,
    defaultEntryId,
    joinId,
    mode,
  };
}

function isReturningSwitch<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  graph: LayoutGraph<TNode, TEdge>,
  {
    caseEntryByDecisionId,
    defaultEntryId,
    decisionIds,
    joinId,
  }: {
    caseEntryByDecisionId: Map<string, string>;
    defaultEntryId?: string;
    decisionIds: string[];
    joinId?: string;
  },
) {
  if (joinId) {
    return false;
  }

  const entryIds = [
    ...decisionIds
      .map((decisionId) => caseEntryByDecisionId.get(decisionId))
      .filter((entryId): entryId is string => Boolean(entryId)),
    defaultEntryId,
  ].filter((entryId): entryId is string => Boolean(entryId));

  return (
    entryIds.length > 0 &&
    entryIds.every((entryId) => graph.nodeById.get(entryId)?.type === "return")
  );
}

function getCommonTarget(targetIds: string[]) {
  if (targetIds.length === 0) {
    return undefined;
  }

  const [firstTargetId] = targetIds;

  return targetIds.every((targetId) => targetId === firstTargetId)
    ? firstTargetId
    : undefined;
}

function getSwitchExitX<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  {
    fallbackX,
    joinId,
    switchBounds,
  }: {
    fallbackX: number;
    joinId?: string;
    switchBounds: LayoutBounds;
  },
) {
  if (!joinId) {
    return fallbackX;
  }

  const joinNode = context.graph.nodeById.get(joinId);

  if (joinNode?.type === "end") {
    return Math.max(fallbackX, switchBounds.maxX + layoutSpacing.caseNodeGapX);
  }

  return fallbackX;
}

function getHandlePositionsByNodeId<TNode extends AutoLayoutNode>({
  edges,
  forcedHandlesByNodeId,
  nodes,
  placements,
}: {
  edges: AutoLayoutEdge[];
  forcedHandlesByNodeId: Map<string, FlowNodeHandlePositions>;
  nodes: TNode[];
  placements: Map<string, CenterPoint>;
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const handlePositionsByNodeId = new Map<string, FlowNodeHandlePositions>();

  for (const node of nodes) {
    handlePositionsByNodeId.set(node.id, {
      ...getDefaultFlowNodeHandlePositions(node.type),
      ...forcedHandlesByNodeId.get(node.id),
    });
  }

  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    const sourceCenter = getNodeCenter(sourceNode, placements);
    const targetCenter = getNodeCenter(targetNode, placements);

    if (!sourceNode || !targetNode || !sourceCenter || !targetCenter) {
      continue;
    }

    const sourceHandle = getFlowHandleId(edge.sourceHandle ?? "out");
    const targetHandle = getFlowHandleId(edge.targetHandle ?? "in");
    const sourceSide = getDominantSide(
      targetCenter.x - sourceCenter.x,
      targetCenter.y - sourceCenter.y,
    );
    const targetSide = getOppositeSide(sourceSide);

    if (
      sourceHandle &&
      !forcedHandlesByNodeId.get(sourceNode.id)?.[sourceHandle]
      && shouldUseEdgeAwareSourceHandle(sourceNode, targetNode)
    ) {
      setNodeHandlePosition(
        handlePositionsByNodeId,
        sourceNode.id,
        sourceHandle,
        sourceSide,
      );
    }

    if (
      targetHandle &&
      !forcedHandlesByNodeId.get(targetNode.id)?.[targetHandle] &&
      shouldUseEdgeAwareTargetHandle(targetNode, targetSide)
    ) {
      setNodeHandlePosition(
        handlePositionsByNodeId,
        targetNode.id,
        targetHandle,
        targetSide,
      );
    }
  }

  for (const node of nodes) {
    handlePositionsByNodeId.set(node.id, {
      ...getDefaultFlowNodeHandlePositions(node.type),
      ...handlePositionsByNodeId.get(node.id),
    });
    handlePositionsByNodeId.set(
      node.id,
      separateDecisionBranchHandles(
        node,
        separateInputOutputHandles(
          node,
          handlePositionsByNodeId.get(node.id) ?? {},
        ),
      ),
    );
  }

  return handlePositionsByNodeId;
}

function separateDecisionBranchHandles(
  node: AutoLayoutNode,
  handlePositions: FlowNodeHandlePositions,
): FlowNodeHandlePositions {
  if (
    node.type !== "decision" ||
    !handlePositions.yes ||
    !handlePositions.no ||
    handlePositions.yes !== handlePositions.no
  ) {
    return handlePositions;
  }

  return {
    ...handlePositions,
    no: getSeparatedNoHandlePosition(handlePositions.yes),
  };
}

function getSeparatedNoHandlePosition(
  yesPosition: FlowHandlePosition,
): FlowHandlePosition {
  if (yesPosition === "left") {
    return "right";
  }

  if (yesPosition === "right") {
    return "bottom";
  }

  return "right";
}

function separateInputOutputHandles(
  node: AutoLayoutNode,
  handlePositions: FlowNodeHandlePositions,
): FlowNodeHandlePositions {
  if (
    !hasInputOutputHandles(node) ||
    !handlePositions.in ||
    !handlePositions.out ||
    handlePositions.in !== handlePositions.out
  ) {
    return handlePositions;
  }

  return {
    ...handlePositions,
    out: getSeparatedOutputHandlePosition(handlePositions.in),
  };
}

function hasInputOutputHandles(node: AutoLayoutNode) {
  return (
    node.type === "process" ||
    node.type === "input" ||
    node.type === "output" ||
    node.type === "functionCall"
  );
}

function getSeparatedOutputHandlePosition(
  inputPosition: FlowHandlePosition,
): FlowHandlePosition {
  if (inputPosition === "top") {
    return "bottom";
  }

  if (inputPosition === "bottom") {
    return "top";
  }

  return inputPosition === "left" ? "right" : "left";
}

function shouldUseEdgeAwareTargetHandle(
  targetNode: AutoLayoutNode,
  targetSide: FlowHandlePosition,
) {
  if (targetNode.type === "end") {
    return targetSide === "top";
  }

  if (targetNode.type === "return") {
    return targetSide === "top" || targetSide === "left";
  }

  return true;
}

function shouldUseEdgeAwareSourceHandle(
  sourceNode: AutoLayoutNode,
  targetNode: AutoLayoutNode,
) {
  if (sourceNode.type === "output" && targetNode.type === "end") {
    return false;
  }

  return true;
}

function forceNodeHandles<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  nodeId: string,
  handlePositions: FlowNodeHandlePositions,
) {
  context.forcedHandlesByNodeId.set(nodeId, {
    ...context.forcedHandlesByNodeId.get(nodeId),
    ...handlePositions,
  });
}

function setNodeHandlePosition(
  handlePositionsByNodeId: Map<string, FlowNodeHandlePositions>,
  nodeId: string,
  handleId: FlowNodeHandleId,
  position: FlowHandlePosition,
) {
  handlePositionsByNodeId.set(nodeId, {
    ...handlePositionsByNodeId.get(nodeId),
    [handleId]: position,
  });
}

function getFlowHandleId(value: string | null | undefined) {
  return flowHandleIds.has(value ?? "")
    ? (value as FlowNodeHandleId)
    : undefined;
}

function getDominantSide(dx: number, dy: number): FlowHandlePosition {
  if (Math.abs(dx) > Math.abs(dy) * 1.1) {
    return dx >= 0 ? "right" : "left";
  }

  return dy >= 0 ? "bottom" : "top";
}

function getOppositeSide(position: FlowHandlePosition): FlowHandlePosition {
  if (position === "top") {
    return "bottom";
  }

  if (position === "bottom") {
    return "top";
  }

  return position === "left" ? "right" : "left";
}

function getNodeCenter(
  node: AutoLayoutNode | undefined,
  placements: Map<string, CenterPoint>,
) {
  if (!node) {
    return undefined;
  }

  const placedCenter = placements.get(node.id);

  if (placedCenter) {
    return placedCenter;
  }

  const size = getNodeSize(node);

  return {
    x: node.position.x + size.width / 2,
    y: node.position.y + size.height / 2,
  };
}

function getNodeBounds(node: AutoLayoutNode, center: CenterPoint): LayoutBounds {
  const size = getNodeSize(node);

  return {
    maxX: center.x + size.width / 2,
    maxY: center.y + size.height / 2,
    minX: center.x - size.width / 2,
    minY: center.y - size.height / 2,
  };
}

function getPlacedBounds<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(context: LayoutContext<TNode, TEdge>) {
  let bounds = createEmptyBounds();

  for (const [nodeId, center] of context.placements.entries()) {
    const node = context.graph.nodeById.get(nodeId);

    if (node) {
      bounds = mergeBounds(bounds, getNodeBounds(node, center));
    }
  }

  return bounds;
}

function getNodeSize(node: AutoLayoutNode): NodeSize {
  const measuredWidth = node.measured?.width ?? node.width;
  const measuredHeight = node.measured?.height ?? node.height;

  if (measuredWidth && measuredHeight) {
    return {
      height: measuredHeight,
      width: measuredWidth,
    };
  }

  const baseSize = baseNodeSizes[node.type];
  const labelLength = node.data.label.length;

  if (node.type === "process") {
    return {
      ...baseSize,
      width: clamp(190, 340, 150 + labelLength * 5.6),
    };
  }

  if (node.type === "output") {
    return {
      ...baseSize,
      width: clamp(baseSize.width, 390, 170 + labelLength * 4.8),
    };
  }

  if (node.type === "functionCall") {
    return {
      ...baseSize,
      width: clamp(210, 310, 170 + labelLength * 4),
    };
  }

  if (node.type === "decision") {
    return {
      ...baseSize,
      width: clamp(200, 260, 165 + labelLength * 3.8),
    };
  }

  return baseSize;
}

function getDecisionControlFlow(node: AutoLayoutNode) {
  return node.type === "decision" && "condition" in node.data.config
    ? node.data.config.controlFlow
    : undefined;
}

function getDecisionControlFlowKind(node: AutoLayoutNode) {
  return getDecisionControlFlow(node)?.kind;
}

function isLoopUpdateNode(node: AutoLayoutNode | undefined) {
  return (
    node?.type === "process" &&
    "instruction" in node.data.config &&
    node.data.config.controlFlow?.kind === "forUpdate"
  );
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values));
}

function createEmptyBounds(): LayoutBounds {
  return {
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
  };
}

function isBoundsEmpty(bounds: LayoutBounds) {
  return (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxY)
  );
}

function mergeBounds(left: LayoutBounds, right: LayoutBounds): LayoutBounds {
  if (isBoundsEmpty(left)) {
    return right;
  }

  if (isBoundsEmpty(right)) {
    return left;
  }

  return {
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY),
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
  };
}

function clamp(minValue: number, maxValue: number, value: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function roundLayoutValue(value: number) {
  return Math.round(value * 100) / 100;
}
