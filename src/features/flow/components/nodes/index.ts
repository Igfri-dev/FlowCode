import { memo } from "react";
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
  start: memo(StartNode),
  end: memo(EndNode),
  process: memo(ProcessNode),
  decision: memo(DecisionNode),
  input: memo(InputNode),
  output: memo(OutputNode),
  functionCall: memo(FunctionCallNode),
  return: memo(ReturnNode),
} satisfies NodeTypes;
