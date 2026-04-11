import type { XYPosition } from "@xyflow/react";
import type {
  FlowEditorNode,
  FlowNodeConfig,
  FlowNodeConfigChangeHandler,
  FlowNodeDataByType,
  FlowNodeLabelChangeHandler,
  FlowNodeType,
} from "@/types/flow";

const flowNodeData: {
  [TType in FlowNodeType]: FlowNodeDataByType[TType];
} = {
  start: {
    label: "Inicio",
    config: {},
  },
  end: {
    label: "Fin",
    config: {},
  },
  process: {
    label: "x = x + 1",
    config: {
      instruction: "x = x + 1",
    },
  },
  decision: {
    label: "x > 5",
    config: {
      condition: "x > 5",
    },
  },
};

type CreateFlowNodeInput = {
  id: string;
  type: FlowNodeType;
  index: number;
  onLabelChange: FlowNodeLabelChangeHandler;
  onConfigChange: FlowNodeConfigChangeHandler;
};

export function createFlowEditorNode({
  id,
  type,
  index,
  onLabelChange,
  onConfigChange,
}: CreateFlowNodeInput): FlowEditorNode {
  return {
    id,
    type,
    position: getFlowNodePosition(index),
    data: {
      ...flowNodeData[type],
      onLabelChange,
      onConfigChange,
    },
  } as FlowEditorNode;
}

export function getFlowNodeLabelFromConfig(
  type: FlowNodeType,
  config: FlowNodeConfig,
  fallbackLabel: string,
) {
  if (type === "process" && "instruction" in config) {
    return config.instruction;
  }

  if (type === "decision" && "condition" in config) {
    return config.condition;
  }

  return fallbackLabel;
}

function getFlowNodePosition(index: number): XYPosition {
  const column = index % 3;
  const row = Math.floor(index / 3);

  return {
    x: 80 + column * 220,
    y: 80 + row * 160,
  };
}
