import type { NodeChange, XYPosition } from "@xyflow/react";
import {
  getDefaultFlowNodeHandlePositions,
  getFlowHandlePosition,
} from "@/features/flow/handle-positions";
import type {
  FlowEditorEdge,
  FlowEditorNode,
  FlowHandlePosition,
  FlowNodeHandleId,
  FlowNodeType,
} from "@/types/flow";

const flowNodeAlignmentSnapDistance = 18;

const defaultNodeSizes: Record<
  FlowNodeType,
  {
    height: number;
    width: number;
  }
> = {
  start: {
    width: 160,
    height: 52,
  },
  end: {
    width: 160,
    height: 52,
  },
  process: {
    width: 160,
    height: 64,
  },
  decision: {
    width: 192,
    height: 144,
  },
  input: {
    width: 176,
    height: 132,
  },
  output: {
    width: 192,
    height: 120,
  },
  functionCall: {
    width: 192,
    height: 132,
  },
  return: {
    width: 176,
    height: 88,
  },
};

type FlowDragHandleRole = "source" | "target";
type FlowAlignmentAxis = "x" | "y";
type FlowSnapCandidate = {
  distance: number;
  value: number;
};

export type FlowNodeDragAxisLock = "fixX" | "fixY";

export type FlowNodeDragSession = {
  draggedNodeIds: Set<string>;
  initialPositionsByNodeId: Map<string, XYPosition>;
};

export function createFlowNodeDragSession(
  draggedNodes: FlowEditorNode[],
): FlowNodeDragSession {
  return {
    draggedNodeIds: new Set(draggedNodes.map((node) => node.id)),
    initialPositionsByNodeId: new Map(
      draggedNodes.map((node) => [
        node.id,
        {
          x: node.position.x,
          y: node.position.y,
        },
      ]),
    ),
  };
}

export function constrainFlowNodeChange({
  axisLock,
  change,
  dragSession,
  edges,
  nodes,
}: {
  axisLock: FlowNodeDragAxisLock | null;
  change: NodeChange<FlowEditorNode>;
  dragSession: FlowNodeDragSession;
  edges: FlowEditorEdge[];
  nodes: FlowEditorNode[];
}) {
  if (change.type !== "position" || !change.position) {
    return change;
  }

  let nextPosition = {
    x: change.position.x,
    y: change.position.y,
  };
  const initialPosition = dragSession.initialPositionsByNodeId.get(change.id);

  if (axisLock === "fixX" && initialPosition) {
    nextPosition.x = initialPosition.x;
  }

  if (axisLock === "fixY" && initialPosition) {
    nextPosition.y = initialPosition.y;
  }

  if (
    dragSession.draggedNodeIds.size === 1 &&
    dragSession.draggedNodeIds.has(change.id)
  ) {
    nextPosition = getAlignedFlowNodePosition({
      axisLock,
      edges,
      nodeId: change.id,
      nodes,
      position: nextPosition,
    });
  }

  return {
    ...change,
    position: nextPosition,
    positionAbsolute:
      change.positionAbsolute === undefined ? undefined : nextPosition,
  };
}

function getAlignedFlowNodePosition({
  axisLock,
  edges,
  nodeId,
  nodes,
  position,
}: {
  axisLock: FlowNodeDragAxisLock | null;
  edges: FlowEditorEdge[];
  nodeId: string;
  nodes: FlowEditorNode[];
  position: XYPosition;
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const draggedNode = nodeById.get(nodeId);

  if (!draggedNode) {
    return position;
  }

  const draggedNodeAtPosition = {
    ...draggedNode,
    position,
  } satisfies FlowEditorNode;
  let bestXCandidate: FlowSnapCandidate | null = null;
  let bestYCandidate: FlowSnapCandidate | null = null;

  for (const edge of edges) {
    const isDraggedNodeSource = edge.source === nodeId;
    const isDraggedNodeTarget = edge.target === nodeId;

    if (!isDraggedNodeSource && !isDraggedNodeTarget) {
      continue;
    }

    const otherNodeId = isDraggedNodeSource ? edge.target : edge.source;
    const otherNode = nodeById.get(otherNodeId);

    if (!otherNode) {
      continue;
    }

    const draggedHandleRole: FlowDragHandleRole = isDraggedNodeSource
      ? "source"
      : "target";
    const otherHandleRole: FlowDragHandleRole = isDraggedNodeSource
      ? "target"
      : "source";
    const draggedHandleId = normalizeFlowHandleId(
      isDraggedNodeSource ? edge.sourceHandle : edge.targetHandle,
      draggedHandleRole,
    );
    const otherHandleId = normalizeFlowHandleId(
      isDraggedNodeSource ? edge.targetHandle : edge.sourceHandle,
      otherHandleRole,
    );
    const draggedHandlePosition = getNodeHandlePosition(
      draggedNodeAtPosition,
      draggedHandleId,
      draggedHandleRole,
    );
    const otherHandlePosition = getNodeHandlePosition(
      otherNode,
      otherHandleId,
      otherHandleRole,
    );
    const alignmentAxis = getFlowAlignmentAxis(
      draggedHandlePosition,
      otherHandlePosition,
    );

    if (alignmentAxis === "x" && axisLock !== "fixX") {
      const draggedHandleOffset = getNodeHandleOffset(
        draggedNodeAtPosition,
        draggedHandlePosition,
      );
      const otherHandleAnchor = getNodeHandleAnchor(
        otherNode,
        otherHandlePosition,
      );
      const handleDistance = Math.abs(
        position.x + draggedHandleOffset.x - otherHandleAnchor.x,
      );

      if (handleDistance <= flowNodeAlignmentSnapDistance) {
        bestXCandidate = getPreferredFlowSnapCandidate(bestXCandidate, {
          distance: handleDistance,
          value: otherHandleAnchor.x - draggedHandleOffset.x,
        });
      }
    }

    if (alignmentAxis === "y" && axisLock !== "fixY") {
      const draggedHandleOffset = getNodeHandleOffset(
        draggedNodeAtPosition,
        draggedHandlePosition,
      );
      const otherHandleAnchor = getNodeHandleAnchor(
        otherNode,
        otherHandlePosition,
      );
      const handleDistance = Math.abs(
        position.y + draggedHandleOffset.y - otherHandleAnchor.y,
      );

      if (handleDistance <= flowNodeAlignmentSnapDistance) {
        bestYCandidate = getPreferredFlowSnapCandidate(bestYCandidate, {
          distance: handleDistance,
          value: otherHandleAnchor.y - draggedHandleOffset.y,
        });
      }
    }
  }

  return {
    x: bestXCandidate?.value ?? position.x,
    y: bestYCandidate?.value ?? position.y,
  };
}

function normalizeFlowHandleId(
  handleId: string | null | undefined,
  role: FlowDragHandleRole,
): FlowNodeHandleId {
  if (
    handleId === "in" ||
    handleId === "out" ||
    handleId === "yes" ||
    handleId === "no"
  ) {
    return handleId;
  }

  return role === "source" ? "out" : "in";
}

function getNodeHandlePosition(
  node: FlowEditorNode,
  handleId: FlowNodeHandleId,
  role: FlowDragHandleRole,
) {
  const fallback =
    getDefaultFlowNodeHandlePositions(node.type)[handleId] ??
    (role === "source" ? "bottom" : "top");

  return getFlowHandlePosition({
    fallback,
    handleId,
    handlePositions: node.data.handlePositions,
  });
}

function getFlowAlignmentAxis(
  draggedHandlePosition: FlowHandlePosition,
  otherHandlePosition: FlowHandlePosition,
): FlowAlignmentAxis | null {
  if (
    (draggedHandlePosition === "top" && otherHandlePosition === "bottom") ||
    (draggedHandlePosition === "bottom" && otherHandlePosition === "top")
  ) {
    return "x";
  }

  if (
    (draggedHandlePosition === "left" && otherHandlePosition === "right") ||
    (draggedHandlePosition === "right" && otherHandlePosition === "left")
  ) {
    return "y";
  }

  return null;
}

function getPreferredFlowSnapCandidate(
  currentCandidate: FlowSnapCandidate | null,
  nextCandidate: FlowSnapCandidate,
) {
  if (!currentCandidate || nextCandidate.distance < currentCandidate.distance) {
    return nextCandidate;
  }

  return currentCandidate;
}

function getNodeHandleAnchor(
  node: FlowEditorNode,
  handlePosition: FlowHandlePosition,
) {
  const handleOffset = getNodeHandleOffset(node, handlePosition);

  return {
    x: node.position.x + handleOffset.x,
    y: node.position.y + handleOffset.y,
  };
}

function getNodeHandleOffset(
  node: FlowEditorNode,
  handlePosition: FlowHandlePosition,
) {
  const size = getFlowNodeSize(node);

  if (handlePosition === "top") {
    return {
      x: size.width / 2,
      y: 0,
    };
  }

  if (handlePosition === "right") {
    return {
      x: size.width,
      y: size.height / 2,
    };
  }

  if (handlePosition === "bottom") {
    return {
      x: size.width / 2,
      y: size.height,
    };
  }

  return {
    x: 0,
    y: size.height / 2,
  };
}

function getFlowNodeSize(node: FlowEditorNode) {
  const defaultSize = defaultNodeSizes[node.type];

  return {
    width: node.measured?.width ?? node.width ?? defaultSize.width,
    height: node.measured?.height ?? node.height ?? defaultSize.height,
  };
}
