import type { Edge, Node } from "@xyflow/react";

export const flowNodeTypes = ["start", "end", "process", "decision"] as const;

export type FlowNodeType = (typeof flowNodeTypes)[number];

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
  };
  end: {
    label: string;
    config: EndNodeConfig;
  };
  process: {
    label: string;
    config: ProcessNodeConfig;
  };
  decision: {
    label: string;
    config: DecisionNodeConfig;
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

export type FlowEditorNodeDataByType = {
  [TType in FlowNodeType]: FlowNodeDataByType[TType] & {
    onLabelChange: FlowNodeLabelChangeHandler;
    onConfigChange: FlowNodeConfigChangeHandler;
  };
};

export type FlowEditorNodeData = {
  label: string;
  config: FlowNodeConfig;
  onLabelChange: FlowNodeLabelChangeHandler;
  onConfigChange: FlowNodeConfigChangeHandler;
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
