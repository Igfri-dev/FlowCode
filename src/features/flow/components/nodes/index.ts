import type { NodeTypes } from "@xyflow/react";
import { DecisionNode } from "./DecisionNode";
import { EndNode } from "./EndNode";
import { FunctionCallNode } from "./FunctionCallNode";
import { InputNode } from "./InputNode";
import { OutputNode } from "./OutputNode";
import { ProcessNode } from "./ProcessNode";
import { ReturnNode } from "./ReturnNode";
import { StartNode } from "./StartNode";

export const flowNodeComponents = {
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  decision: DecisionNode,
  input: InputNode,
  output: OutputNode,
  functionCall: FunctionCallNode,
  return: ReturnNode,
} satisfies NodeTypes;
