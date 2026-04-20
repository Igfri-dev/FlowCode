import { memo } from "react";
import type { EdgeTypes } from "@xyflow/react";
import { FlowEdge } from "./FlowEdge";

export const flowEdgeComponents = {
  flow: memo(FlowEdge),
} satisfies EdgeTypes;
