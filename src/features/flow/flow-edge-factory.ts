import { MarkerType, type Connection } from "@xyflow/react";
import type { FlowEditorEdge } from "@/types/flow";

const decisionBranchLabels: Record<string, string> = {
  yes: "Sí",
  no: "No",
};

export function createFlowEditorEdge(connection: Connection): FlowEditorEdge {
  return {
    ...connection,
    id: createFlowEdgeId(connection),
    type: "flow",
    label: getFlowEdgeLabel(connection.sourceHandle),
    interactionWidth: 34,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#525252",
    },
    style: {
      stroke: "#525252",
      strokeWidth: 2,
    },
    labelStyle: {
      fill: "#262626",
      fontWeight: 600,
    },
    labelBgStyle: {
      fill: "#f5f5f5",
    },
    labelBgBorderRadius: 4,
    labelBgPadding: [6, 4],
  };
}

function createFlowEdgeId(connection: Connection) {
  const sourceHandle = connection.sourceHandle ?? "out";
  const targetHandle = connection.targetHandle ?? "in";

  return `edge-${connection.source}-${sourceHandle}-${connection.target}-${targetHandle}`;
}

function getFlowEdgeLabel(sourceHandle: string | null) {
  if (!sourceHandle) {
    return undefined;
  }

  return decisionBranchLabels[sourceHandle];
}
