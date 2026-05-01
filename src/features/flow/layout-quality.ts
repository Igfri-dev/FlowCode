import type {
  AutoLayoutEdge,
  AutoLayoutNode,
} from "@/features/flow/auto-layout";
import type { FlowNodeType } from "@/types/flow";

type NodeBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type NodeSize = {
  width: number;
  height: number;
};

export type FlowLayoutOverlap = {
  firstNodeId: string;
  secondNodeId: string;
};

export type FlowLayoutHandleConflict = {
  nodeId: string;
  message: string;
};

export type FlowLayoutQualityReport = {
  decisionCount: number;
  edgeCount: number;
  handleConflicts: FlowLayoutHandleConflict[];
  nodeCount: number;
  overlaps: FlowLayoutOverlap[];
};

const fallbackNodeSizes: Record<FlowNodeType, NodeSize> = {
  decision: { width: 210, height: 146 },
  end: { width: 160, height: 48 },
  functionCall: { width: 230, height: 92 },
  input: { width: 250, height: 118 },
  output: { width: 313, height: 135 },
  process: { width: 210, height: 66 },
  return: { width: 210, height: 58 },
  start: { width: 160, height: 48 },
};

export function analyzeFlowLayout({
  edges,
  nodes,
}: {
  edges: AutoLayoutEdge[];
  nodes: AutoLayoutNode[];
}): FlowLayoutQualityReport {
  return {
    decisionCount: nodes.filter((node) => node.type === "decision").length,
    edgeCount: edges.length,
    handleConflicts: findDecisionHandleConflicts(nodes),
    nodeCount: nodes.length,
    overlaps: findNodeOverlaps(nodes),
  };
}

export function findNodeOverlaps(
  nodes: AutoLayoutNode[],
): FlowLayoutOverlap[] {
  const overlaps: FlowLayoutOverlap[] = [];

  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < nodes.length;
      rightIndex += 1
    ) {
      const leftNode = nodes[leftIndex];
      const rightNode = nodes[rightIndex];

      if (nodeBoundsOverlap(getNodeBounds(leftNode), getNodeBounds(rightNode))) {
        overlaps.push({
          firstNodeId: leftNode.id,
          secondNodeId: rightNode.id,
        });
      }
    }
  }

  return overlaps;
}

export function findDecisionHandleConflicts(
  nodes: AutoLayoutNode[],
): FlowLayoutHandleConflict[] {
  return nodes.flatMap((node) => {
    if (node.type !== "decision") {
      return [];
    }

    const yesPosition = node.data.handlePositions?.yes;
    const noPosition = node.data.handlePositions?.no;

    if (!yesPosition || !noPosition) {
      return [
        {
          nodeId: node.id,
          message: "La decision no tiene ambos handles Si/No definidos.",
        },
      ];
    }

    if (yesPosition === noPosition) {
      return [
        {
          nodeId: node.id,
          message: "La decision usa el mismo lado para Si y No.",
        },
      ];
    }

    return [];
  });
}

export function getNodeBounds(node: AutoLayoutNode): NodeBounds {
  const size = getNodeSize(node);

  return {
    bottom: node.position.y + size.height,
    left: node.position.x,
    right: node.position.x + size.width,
    top: node.position.y,
  };
}

function getNodeSize(node: AutoLayoutNode): NodeSize {
  return {
    width: node.measured?.width ?? node.width ?? fallbackNodeSizes[node.type].width,
    height:
      node.measured?.height ?? node.height ?? fallbackNodeSizes[node.type].height,
  };
}

function nodeBoundsOverlap(first: NodeBounds, second: NodeBounds) {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}
