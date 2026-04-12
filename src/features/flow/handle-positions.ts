import { Position } from "@xyflow/react";
import type {
  FlowHandlePosition,
  FlowNodeHandleId,
  FlowNodeHandlePositions,
  FlowNodeType,
} from "@/types/flow";

export const flowHandlePositionOptions: {
  value: FlowHandlePosition;
  label: string;
}[] = [
  { value: "top", label: "Arriba" },
  { value: "right", label: "Derecha" },
  { value: "bottom", label: "Abajo" },
  { value: "left", label: "Izquierda" },
];

export function getDefaultFlowNodeHandlePositions(
  type: FlowNodeType,
): FlowNodeHandlePositions {
  if (type === "start") {
    return {
      out: "bottom",
    };
  }

  if (type === "end") {
    return {
      in: "top",
    };
  }

  if (type === "decision") {
    return {
      in: "top",
      yes: "left",
      no: "right",
    };
  }

  return {
    in: "top",
    out: "bottom",
  };
}

export function getFlowHandlePosition({
  fallback,
  handleId,
  handlePositions,
}: {
  fallback: FlowHandlePosition;
  handleId: FlowNodeHandleId;
  handlePositions?: FlowNodeHandlePositions;
}) {
  return handlePositions?.[handleId] ?? fallback;
}

export function toReactFlowPosition(position: FlowHandlePosition) {
  if (position === "top") {
    return Position.Top;
  }

  if (position === "right") {
    return Position.Right;
  }

  if (position === "bottom") {
    return Position.Bottom;
  }

  return Position.Left;
}
