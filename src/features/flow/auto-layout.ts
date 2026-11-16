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

type LayoutContext<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
> = {
  doWhileConditionByBodyEntryId: Map<string, string>;
  forcedHandlesByNodeId: Map<string, FlowNodeHandlePositions>;
  graph: LayoutGraph<TNode, TEdge>;
  placedNodeIds: Set<string>;
  placements: Map<string, CenterPoint>;
};

// Change this value to tune the minimum visual gap between any two blocks.
export const autoLayoutMinimumBlockGap = 72;

// Connected blocks closer than this are snapped onto the same visual axis.
export const autoLayoutSnapAlignmentDistance = 48;

const layoutSpacing = {
  branchGapX: 330,
  caseBodyGapX: 360,
  defaultOriginX: 360,
  defaultOriginY: 64,
  joinGapY: 145,
  loopExitGapX: 360,
  loopGapY: 175,
  minimumBlockGap: autoLayoutMinimumBlockGap,
  nodeGapY: 96,
  orphanGapX: 420,
  orphanGapY: 190,
  snapAlignmentDistance: autoLayoutSnapAlignmentDistance,
  switchExitGapX: 520,
} as const;

const baseNodeSizes: Record<FlowNodeType, NodeSize> = {
  decision: { width: 208, height: 144 },
  end: { width: 160, height: 48 },
  functionCall: { width: 192, height: 123 },
  input: { width: 176, height: 127 },
  output: { width: 313, height: 135 },
  process: { width: 188, height: 61 },
  return: { width: 203, height: 78 },
  start: { width: 160, height: 48 },
};

const flowHandleIds = new Set<string>(["in", "out", "yes", "no"]);

export function applySmartFlowLayout<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>({ edges, nodes }: { edges: TEdge[]; nodes: TNode[] }) {
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
      x: node.position.x + getAutoLayoutNodeSize(node).width / 2,
      y: node.position.y + getAutoLayoutNodeSize(node).height / 2,
    };
    const size = getAutoLayoutNodeSize(node);

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
    const nextNode = currentId
      ? context.graph.nodeById.get(currentId)
      : undefined;
    currentY =
      nodeBounds.maxY +
      layoutSpacing.nodeGapY +
      (nextNode ? getAutoLayoutNodeSize(nextNode).height / 2 : 0);
  }

  return {
    bounds,
    nextY: currentY,
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
  }: { node: TNode; stopIds: Set<string>; x: number; y: number },
): StructureLayoutResult {
  forceNodeHandles(context, node.id, { in: "top", no: "right", yes: "left" });
  let bounds = placeNode(context, node.id, x, y);
  const yesTargetId = getTargetByHandle(context.graph, node.id, "yes");
  const noTargetId = getTargetByHandle(context.graph, node.id, "no");
  const joinId = findBranchJoin(context.graph, {
    branchTargetIds: [yesTargetId, noTargetId],
    blockedIds: new Set([node.id, ...stopIds]),
  });
  const branchStopIds = new Set(stopIds);
  if (joinId) branchStopIds.add(joinId);

  for (const [targetId, direction] of [
    [yesTargetId, -1],
    [noTargetId, 1],
  ] as const) {
    if (!targetId || targetId === joinId) continue;
    const target = context.graph.nodeById.get(targetId);
    if (!target) continue;
    const placedBefore = new Set(context.placedNodeIds);
    const result = layoutSequence(context, {
      startId: targetId,
      stopIds: branchStopIds,
      x: x + direction * layoutSpacing.branchGapX,
      y:
        boundsForNode(context, node.id).maxY +
        layoutSpacing.nodeGapY +
        getAutoLayoutNodeSize(target).height / 2,
    });
    const boundary = x + direction * layoutSpacing.minimumBlockGap;
    const shiftX =
      direction < 0
        ? Math.min(0, boundary - result.bounds.maxX)
        : Math.max(0, boundary - result.bounds.minX);
    bounds = mergeBounds(
      bounds,
      translateNewPlacements(context, placedBefore, shiftX),
    );
  }

  const joinNode = joinId ? context.graph.nodeById.get(joinId) : undefined;
  return {
    bounds,
    nextId: joinId,
    nextX: x,
    nextY:
      bounds.maxY +
      layoutSpacing.joinGapY +
      (joinNode ? getAutoLayoutNodeSize(joinNode).height / 2 : 0),
  };
}

// Move an entire already laid-out branch together so its internal alignment survives.
function translateNewPlacements<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  previousIds: Set<string>,
  shiftX: number,
): LayoutBounds {
  let bounds = createEmptyBounds();
  for (const [id, center] of context.placements) {
    if (previousIds.has(id)) continue;
    const nextCenter = { x: center.x + shiftX, y: center.y };
    context.placements.set(id, nextCenter);
    const node = context.graph.nodeById.get(id);
    if (node) bounds = mergeBounds(bounds, getNodeBounds(node, nextCenter));
  }
  return bounds;
}

function boundsForNode<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(context: LayoutContext<TNode, TEdge>, id: string): LayoutBounds {
  const node = context.graph.nodeById.get(id);
  const center = context.placements.get(id);
  return node && center ? getNodeBounds(node, center) : createEmptyBounds();
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
  }: { node: TNode; stopIds: Set<string>; x: number; y: number },
): StructureLayoutResult {
  forceNodeHandles(context, node.id, { in: "top", no: "right", yes: "bottom" });
  let bounds = placeNode(context, node.id, x, y);
  const yesTargetId = getTargetByHandle(context.graph, node.id, "yes");
  const noTargetId = getTargetByHandle(context.graph, node.id, "no");
  const controlFlow = getDecisionControlFlow(node);
  const loopUpdateNodeId =
    (controlFlow?.kind === "for" ? controlFlow.updateNodeId : undefined) ??
    inferLoopUpdateNodeId(context.graph, yesTargetId, node.id);
  const loopStopIds = new Set([...stopIds, node.id]);
  if (loopUpdateNodeId) loopStopIds.add(loopUpdateNodeId);

  const bodyEntry = yesTargetId
    ? context.graph.nodeById.get(yesTargetId)
    : undefined;
  if (bodyEntry && yesTargetId !== loopUpdateNodeId) {
    const result = layoutSequence(context, {
      startId: bodyEntry.id,
      stopIds: loopStopIds,
      x,
      y:
        bounds.maxY +
        layoutSpacing.nodeGapY +
        getAutoLayoutNodeSize(bodyEntry).height / 2,
    });
    bounds = mergeBounds(bounds, result.bounds);
  }

  const updateNode = loopUpdateNodeId
    ? context.graph.nodeById.get(loopUpdateNodeId)
    : undefined;
  if (updateNode) {
    forceNodeHandles(context, updateNode.id, { in: "top", out: "left" });
    bounds = mergeBounds(
      bounds,
      placeNode(
        context,
        updateNode.id,
        x,
        bounds.maxY +
          layoutSpacing.nodeGapY +
          getAutoLayoutNodeSize(updateNode).height / 2,
      ),
    );
  }

  const exitNode = noTargetId
    ? context.graph.nodeById.get(noTargetId)
    : undefined;
  return {
    bounds,
    nextId: noTargetId,
    nextX: Math.max(
      x + layoutSpacing.loopExitGapX,
      bounds.maxX +
        layoutSpacing.minimumBlockGap +
        (exitNode ? getAutoLayoutNodeSize(exitNode).width / 2 : 0),
    ),
    nextY:
      bounds.maxY +
      layoutSpacing.nodeGapY +
      (exitNode ? getAutoLayoutNodeSize(exitNode).height / 2 : 0),
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
  const conditionX = x;
  const conditionY = isBoundsEmpty(bodyBounds)
    ? y + layoutSpacing.loopGapY
    : bodyBounds.maxY +
      layoutSpacing.nodeGapY +
      (conditionNode ? getAutoLayoutNodeSize(conditionNode).height / 2 : 0);
  let bounds = bodyResult.bounds;

  if (conditionNode) {
    forceNodeHandles(context, conditionId, {
      in: "top",
      no: "bottom",
      yes: "left",
    });
    bounds = mergeBounds(
      bounds,
      placeNode(context, conditionId, conditionX, conditionY),
    );
  }

  return {
    bounds,
    nextId: conditionNode
      ? getTargetByHandle(context.graph, conditionId, "no")
      : undefined,
    nextX: conditionX,
    nextY: bounds.maxY + layoutSpacing.loopGapY,
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
  const decisionIds = switchInfo.decisionIds.length
    ? switchInfo.decisionIds
    : [node.id];
  const bodyStopIds = new Set([...stopIds, ...decisionIds]);
  const joinId = switchInfo.joinId;
  if (joinId) bodyStopIds.add(joinId);
  let decisionY = y;

  for (const [index, decisionId] of decisionIds.entries()) {
    const decision = context.graph.nodeById.get(decisionId);
    if (!decision) continue;
    forceNodeHandles(context, decisionId, {
      in: "top",
      no: "bottom",
      yes: "right",
    });
    let rowBounds = placeNode(context, decisionId, x, decisionY);
    const bodyEntryId =
      switchInfo.caseEntryByDecisionId.get(decisionId) ??
      getTargetByHandle(context.graph, decisionId, "yes");
    const bodyEntry = bodyEntryId
      ? context.graph.nodeById.get(bodyEntryId)
      : undefined;
    if (bodyEntry && bodyEntryId !== joinId) {
      const placedBefore = new Set(context.placedNodeIds);
      const bodyResult = layoutSwitchCaseBody(context, {
        startId: bodyEntry.id,
        stopIds: bodyStopIds,
        x: x + layoutSpacing.caseBodyGapX,
        y: decisionY,
      });
      const shiftX = Math.max(
        0,
        rowBounds.maxX + layoutSpacing.minimumBlockGap - bodyResult.bounds.minX,
      );
      rowBounds = mergeBounds(
        rowBounds,
        translateNewPlacements(context, placedBefore, shiftX),
      );
    }
    bounds = mergeBounds(bounds, rowBounds);
    const nextDecision = context.graph.nodeById.get(decisionIds[index + 1]);
    decisionY =
      rowBounds.maxY +
      layoutSpacing.nodeGapY +
      (nextDecision ? getAutoLayoutNodeSize(nextDecision).height / 2 : 0);
  }

  const defaultNode = switchInfo.defaultEntryId
    ? context.graph.nodeById.get(switchInfo.defaultEntryId)
    : undefined;
  if (defaultNode && defaultNode.id !== joinId) {
    const result = layoutSequence(context, {
      startId: defaultNode.id,
      stopIds: bodyStopIds,
      x,
      y:
        bounds.maxY +
        layoutSpacing.nodeGapY +
        getAutoLayoutNodeSize(defaultNode).height / 2,
    });
    bounds = mergeBounds(bounds, result.bounds);
  }

  const joinNode = joinId ? context.graph.nodeById.get(joinId) : undefined;
  return {
    bounds,
    nextId: joinId,
    nextX: joinNode
      ? Math.max(
          x + layoutSpacing.switchExitGapX,
          bounds.maxX +
            layoutSpacing.minimumBlockGap +
            getAutoLayoutNodeSize(joinNode).width / 2,
        )
      : x,
    nextY:
      bounds.maxY +
      layoutSpacing.joinGapY +
      (joinNode ? getAutoLayoutNodeSize(joinNode).height / 2 : 0),
  };
}

// Compact, straight case rows match hand-drawn flowcharts; nested decisions use
// the full recursive layout and reserve their complete subtree instead.
function layoutSwitchCaseBody<
  TNode extends AutoLayoutNode,
  TEdge extends AutoLayoutEdge,
>(
  context: LayoutContext<TNode, TEdge>,
  options: { startId: string; stopIds: Set<string>; x: number; y: number },
): SequenceLayoutResult {
  const nodeIds: string[] = [];
  const seen = new Set<string>();
  let currentId: string | undefined = options.startId;
  while (
    currentId &&
    !options.stopIds.has(currentId) &&
    !context.placedNodeIds.has(currentId)
  ) {
    const node = context.graph.nodeById.get(currentId);
    if (
      !node ||
      seen.has(currentId) ||
      node.type === "decision" ||
      context.doWhileConditionByBodyEntryId.has(currentId) ||
      nodeIds.length >= 4
    ) {
      return layoutSequence(context, options);
    }
    seen.add(currentId);
    nodeIds.push(currentId);
    currentId = getLinearSuccessorId(context.graph, currentId);
  }
  let bounds = createEmptyBounds();
  let previousNode: TNode | undefined;
  let centerX = options.x;
  for (const id of nodeIds) {
    const node = context.graph.nodeById.get(id)!;
    if (previousNode)
      centerX +=
        getAutoLayoutNodeSize(previousNode).width / 2 +
        layoutSpacing.minimumBlockGap +
        getAutoLayoutNodeSize(node).width / 2;
    const handles: FlowNodeHandlePositions = { in: "left" };
    if (node.type !== "return" && node.type !== "end") handles.out = "right";
    forceNodeHandles(context, id, handles);
    bounds = mergeBounds(bounds, placeNode(context, id, centerX, options.y));
    previousNode = node;
  }
  return { bounds, nextY: bounds.maxY + layoutSpacing.nodeGapY };
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
    y += getAutoLayoutNodeSize(node).height + layoutSpacing.orphanGapY;
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

    for (
      let anchorIndex = 0;
      anchorIndex < placedNodeIds.length;
      anchorIndex += 1
    ) {
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
            movableCenter.x + (adjustment.axis === "x" ? adjustment.amount : 0),
          y:
            movableCenter.y + (adjustment.axis === "y" ? adjustment.amount : 0),
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

      const candidate = {
        x: targetCenter.x + (adjustment.axis === "x" ? adjustment.amount : 0),
        y: targetCenter.y + (adjustment.axis === "y" ? adjustment.amount : 0),
      };
      const targetNode = context.graph.nodeById.get(edge.target);
      if (!targetNode) continue;
      const candidateBounds = getNodeBounds(targetNode, candidate);
      const collides = Array.from(context.placements).some(([id, center]) => {
        if (id === edge.target) return false;
        const node = context.graph.nodeById.get(id);
        if (!node) return false;
        const otherBounds = getNodeBounds(node, center);
        const gap = layoutSpacing.minimumBlockGap;
        return (
          candidateBounds.minX < otherBounds.maxX + gap &&
          candidateBounds.maxX + gap > otherBounds.minX &&
          candidateBounds.minY < otherBounds.maxY + gap &&
          candidateBounds.maxY + gap > otherBounds.minY
        );
      });
      if (collides) continue;
      context.placements.set(edge.target, candidate);
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
  const targetSideFromGeometry = getPreferredTargetSide(
    sourceNode,
    sourceCenter,
    targetNode,
    targetCenter,
  );
  const sourceSide =
    (sourceHandle
      ? context.forcedHandlesByNodeId.get(sourceNode.id)?.[sourceHandle]
      : undefined) ??
    (sourceHandle && shouldUseEdgeAwareSourceHandle(sourceNode, targetNode)
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
  const overlapX =
    Math.min(expandedAnchorBounds.maxX, expandedMovableBounds.maxX) -
    Math.max(expandedAnchorBounds.minX, expandedMovableBounds.minX);
  const overlapY =
    Math.min(expandedAnchorBounds.maxY, expandedMovableBounds.maxY) -
    Math.max(expandedAnchorBounds.minY, expandedMovableBounds.minY);

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
  const direction = axis === "x" ? (dx >= 0 ? 1 : -1) : dy >= 0 ? 1 : -1;

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

function placeNode<TNode extends AutoLayoutNode, TEdge extends AutoLayoutEdge>(
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
    graph.nodes.find(
      (node) => (graph.incomingByTarget.get(node.id) ?? []).length === 0,
    )?.id ??
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
>(graph: LayoutGraph<TNode, TEdge>, nodeId: string, sourceHandle: string) {
  return graph.outgoingBySourceHandle.get(nodeId)?.get(sourceHandle)?.[0]
    ?.target;
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
>(graph: LayoutGraph<TNode, TEdge>, startId: string, blockedIds: Set<string>) {
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

function hasPath<TNode extends AutoLayoutNode, TEdge extends AutoLayoutEdge>(
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
  const testCases =
    switchMetadata?.cases.filter((item) => item.test !== null) ?? [];
  const defaultEntryId = switchMetadata?.cases.find(
    (item) => item.test === null,
  )?.entryId;

  for (const [index, decisionId] of decisionIds.entries()) {
    const caseEntryId =
      testCases[index]?.entryId ?? getTargetByHandle(graph, decisionId, "yes");

    if (caseEntryId) {
      caseEntryByDecisionId.set(decisionId, caseEntryId);
    }
  }

  const exitSourceIds = switchMetadata?.exitSources ?? [];
  const exitTargets = exitSourceIds
    .map(
      (source) =>
        graph.outgoingBySourceHandle
          .get(source.sourceId)
          ?.get(source.sourceHandle)?.[0]?.target,
    )
    .filter((targetId): targetId is string => Boolean(targetId));
  const joinId = getCommonTarget(exitTargets);

  return {
    caseEntryByDecisionId,
    decisionIds,
    defaultEntryId,
    joinId,
  };
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
    const sourceSide = getDominantSide(
      targetCenter.x - sourceCenter.x,
      targetCenter.y - sourceCenter.y,
    );

    if (
      sourceHandle &&
      !forcedHandlesByNodeId.get(sourceNode.id)?.[sourceHandle] &&
      shouldUseEdgeAwareSourceHandle(sourceNode, targetNode)
    ) {
      setNodeHandlePosition(
        handlePositionsByNodeId,
        sourceNode.id,
        sourceHandle,
        sourceSide,
      );
    }
  }

  for (const node of nodes) {
    const incoming = edges.filter((edge) => edge.target === node.id);
    const byHandle = new Map<string, AutoLayoutEdge[]>();
    for (const edge of incoming) {
      const handle = edge.targetHandle ?? "in";
      const group = byHandle.get(handle) ?? [];
      group.push(edge);
      byHandle.set(handle, group);
    }
    for (const [handle, group] of byHandle) {
      const handleId = getFlowHandleId(handle);
      if (!handleId || forcedHandlesByNodeId.get(node.id)?.[handleId]) continue;
      // Joins and loop entries have one physical input, so its side must not
      // depend on which edge happens to be last in the parser's array.
      let side: FlowHandlePosition = "top";
      if (group.length === 1) {
        const sourceNode = nodeById.get(group[0].source);
        const sourceCenter = getNodeCenter(sourceNode, placements);
        const targetCenter = getNodeCenter(node, placements);
        if (sourceNode && sourceCenter && targetCenter) {
          side = getPreferredTargetSide(
            sourceNode,
            sourceCenter,
            node,
            targetCenter,
          );
        }
      }
      if (shouldUseEdgeAwareTargetHandle(node, side)) {
        setNodeHandlePosition(handlePositionsByNodeId, node.id, handleId, side);
      }
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

function getPreferredTargetSide(
  sourceNode: AutoLayoutNode,
  sourceCenter: CenterPoint,
  targetNode: AutoLayoutNode,
  targetCenter: CenterPoint,
): FlowHandlePosition {
  const sourceBounds = getNodeBounds(sourceNode, sourceCenter);
  const targetBounds = getNodeBounds(targetNode, targetCenter);
  // A branch can be far to the left/right while still flowing downwards.
  // Keep its destination's top port whenever the complete source is above it;
  // genuinely horizontal rows and explicitly forced ports remain lateral.
  if (sourceBounds.maxY <= targetBounds.minY) return "top";
  return getDominantSide(
    sourceCenter.x - targetCenter.x,
    sourceCenter.y - targetCenter.y,
  );
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

  const size = getAutoLayoutNodeSize(node);

  return {
    x: node.position.x + size.width / 2,
    y: node.position.y + size.height / 2,
  };
}

function getNodeBounds(
  node: AutoLayoutNode,
  center: CenterPoint,
): LayoutBounds {
  const size = getAutoLayoutNodeSize(node);

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

// The importer runs before React Flow measures DOM nodes. Match the intrinsic
// form dimensions, then prefer live measurements whenever they are available.
export function getAutoLayoutNodeSize(node: AutoLayoutNode): NodeSize {
  const base = baseNodeSizes[node.type];
  let estimatedHeight = base.height;
  if (node.type === "process") {
    const instruction =
      "instruction" in node.data.config
        ? node.data.config.instruction
        : node.data.label;
    // Monospace textarea is ~19 characters wide, wraps at word boundaries, and
    // grows by a 20px line height. Include padding/border below the textarea.
    const rows = instruction.split(/\r\n|\r|\n/).reduce((total, line) => {
      let count = 1;
      let used = 0;
      for (const token of line.match(/\S+\s*/g) ?? []) {
        const length = token.trimEnd().length;
        if (used > 0 && used + length > 19) {
          count += 1;
          used = 0;
        }
        const wholeLines = Math.max(0, Math.ceil(length / 19) - 1);
        count += wholeLines;
        used =
          (wholeLines > 0 ? 0 : used) +
          length -
          wholeLines * 19 +
          (token.length > length ? 1 : 0);
      }
      return total + count;
    }, 0);
    estimatedHeight = 41 + Math.max(1, rows) * 20;
  }
  return {
    width: node.measured?.width ?? node.width ?? base.width,
    height: node.measured?.height ?? node.height ?? estimatedHeight,
  };
}

function getDecisionControlFlow(node: AutoLayoutNode) {
  return node.type === "decision" && "condition" in node.data.config
    ? node.data.config.controlFlow
    : undefined;
}

function getDecisionControlFlowKind(node: AutoLayoutNode) {
  return getDecisionControlFlow(node)?.kind;
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

function roundLayoutValue(value: number) {
  return Math.round(value * 100) / 100;
}
