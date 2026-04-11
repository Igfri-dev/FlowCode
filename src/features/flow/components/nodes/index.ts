import type { NodeTypes } from "@xyflow/react";
import { DecisionNode } from "./DecisionNode";
import { EndNode } from "./EndNode";
import { ProcessNode } from "./ProcessNode";
import { StartNode } from "./StartNode";

export const flowNodeComponents = {
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  decision: DecisionNode,
} satisfies NodeTypes;
