import type { XYPosition } from "@xyflow/react";
import { getDefaultFlowNodeHandlePositions } from "@/features/flow/handle-positions";
import type {
  FlowEditorNode,
  FlowNodeConfig,
  FlowNodeConfigChangeHandler,
  FlowNodeDataByType,
  FlowNodeHandlePositionsChangeHandler,
  FlowNodeLabelChangeHandler,
  FlowNodeType,
} from "@/types/flow";

const flowNodeData: {
  [TType in FlowNodeType]: FlowNodeDataByType[TType];
} = {
  start: {
    label: "Inicio",
    config: {},
    handlePositions: getDefaultFlowNodeHandlePositions("start"),
  },
  end: {
    label: "Fin",
    config: {},
    handlePositions: getDefaultFlowNodeHandlePositions("end"),
  },
  process: {
    label: "x = x + 1",
    config: {
      instruction: "x = x + 1",
    },
    handlePositions: getDefaultFlowNodeHandlePositions("process"),
  },
  decision: {
    label: "x > 5",
    config: {
      condition: "x > 5",
    },
    handlePositions: getDefaultFlowNodeHandlePositions("decision"),
  },
};

type CreateFlowNodeInput = {
  id: string;
  type: FlowNodeType;
  index: number;
  onLabelChange: FlowNodeLabelChangeHandler;
  onConfigChange: FlowNodeConfigChangeHandler;
  onHandlePositionsChange: FlowNodeHandlePositionsChangeHandler;
};

export function createFlowEditorNode({
  id,
  type,
  index,
  onLabelChange,
  onConfigChange,
  onHandlePositionsChange,
}: CreateFlowNodeInput): FlowEditorNode {
  return {
    id,
    type,
    position: getFlowNodePosition(index),
    data: {
      ...flowNodeData[type],
      onLabelChange,
      onConfigChange,
      onHandlePositionsChange,
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
