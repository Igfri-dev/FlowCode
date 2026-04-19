import { Position } from "@xyflow/react";
import type {
  FlowHandlePosition,
  FlowNodeHandleId,
  FlowNodeHandlePositions,
  FlowNodeType,
} from "@/types/flow";
import type { TranslationKey } from "@/features/i18n/translations";

export const flowHandlePositionOptions: {
  value: FlowHandlePosition;
  labelKey: TranslationKey;
}[] = [
  { value: "top", labelKey: "flow.top" },
  { value: "right", labelKey: "flow.right" },
  { value: "bottom", labelKey: "flow.bottom" },
  { value: "left", labelKey: "flow.left" },
];

export function getDefaultFlowNodeHandlePositions(
  type: FlowNodeType,
): FlowNodeHandlePositions {
  if (type === "start") {
    return {
      out: "bottom",
    };
  }

  if (type === "end" || type === "return") {
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

  if (type === "input" || type === "output" || type === "functionCall") {
    return {
      in: "top",
      out: "bottom",
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
