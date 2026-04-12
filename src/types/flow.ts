import type { Edge, Node } from "@xyflow/react";

export const flowNodeTypes = ["start", "end", "process", "decision"] as const;

export type FlowNodeType = (typeof flowNodeTypes)[number];

export type FlowHandlePosition = "top" | "right" | "bottom" | "left";

export type FlowNodeHandleId = "in" | "out" | "yes" | "no";

export type FlowNodeHandlePositions = Partial<
  Record<FlowNodeHandleId, FlowHandlePosition>
>;

export type StartNodeConfig = Record<string, never>;
export type EndNodeConfig = Record<string, never>;

export type ProcessNodeConfig = {
  instruction: string;
};

export type DecisionNodeConfig = {
  condition: string;
};

export type FlowNodeConfig =
  | StartNodeConfig
  | EndNodeConfig
  | ProcessNodeConfig
  | DecisionNodeConfig;

export type FlowNodeDataByType = {
  start: {
    label: string;
    config: StartNodeConfig;
    handlePositions?: FlowNodeHandlePositions;
  };
  end: {
    label: string;
    config: EndNodeConfig;
    handlePositions?: FlowNodeHandlePositions;
  };
  process: {
    label: string;
    config: ProcessNodeConfig;
    handlePositions?: FlowNodeHandlePositions;
  };
  decision: {
    label: string;
    config: DecisionNodeConfig;
    handlePositions?: FlowNodeHandlePositions;
  };
};

type BaseFlowNode<TType extends FlowNodeType> = {
  id: string;
  type: TType;
  data: FlowNodeDataByType[TType];
};

export type StartNode = BaseFlowNode<"start">;
export type EndNode = BaseFlowNode<"end">;
export type ProcessNode = BaseFlowNode<"process">;
export type DecisionNode = BaseFlowNode<"decision">;

export type FlowNode = StartNode | EndNode | ProcessNode | DecisionNode;

export type FlowNodeData = FlowNode["data"];

export type FlowNodeLabelChangeHandler = (
  nodeId: string,
  label: string,
) => void;

export type FlowNodeConfigChangeHandler = (
  nodeId: string,
  config: FlowNodeConfig,
) => void;

export type FlowNodeHandlePositionsChangeHandler = (
  nodeId: string,
  handlePositions: FlowNodeHandlePositions,
) => void;

export type FlowEditorNodeDataByType = {
  [TType in FlowNodeType]: FlowNodeDataByType[TType] & {
    onLabelChange: FlowNodeLabelChangeHandler;
    onConfigChange: FlowNodeConfigChangeHandler;
    onHandlePositionsChange: FlowNodeHandlePositionsChangeHandler;
  };
};

export type FlowEditorNodeData = {
  label: string;
  config: FlowNodeConfig;
  handlePositions?: FlowNodeHandlePositions;
  onLabelChange: FlowNodeLabelChangeHandler;
  onConfigChange: FlowNodeConfigChangeHandler;
  onHandlePositionsChange: FlowNodeHandlePositionsChangeHandler;
  execution?: {
    isCurrent: boolean;
    isVisited: boolean;
    activeBranch?: "yes" | "no" | null;
  };
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
};

export type FlowDiagram = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type FlowEditorNodeByType<TType extends FlowNodeType> = Node<
  FlowEditorNodeDataByType[TType],
  TType
>;

export type FlowEditorNode = Node<FlowEditorNodeData, FlowNodeType>;

export type FlowEditorEdge = Edge<Record<string, unknown>, "flow">;
