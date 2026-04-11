"use client";

import {
  Background,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  ReactFlow,
  type IsValidConnection,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import type { FlowEditorEdge, FlowEditorNode } from "@/types/flow";

type FlowEditorProps = {
  nodes: FlowEditorNode[];
  edges: FlowEditorEdge[];
  nodeTypes: NodeTypes;
  onNodesChange: OnNodesChange<FlowEditorNode>;
  onEdgesChange: OnEdgesChange<FlowEditorEdge>;
  onConnect: OnConnect;
  isValidConnection: IsValidConnection<FlowEditorEdge>;
};

export function FlowEditor({
  nodes,
  edges,
  nodeTypes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
}: FlowEditorProps) {
  return (
    <ReactFlow<FlowEditorNode, FlowEditorEdge>
      className="h-full min-h-[520px] bg-neutral-100"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      connectionMode={ConnectionMode.Loose}
      connectionLineType={ConnectionLineType.SmoothStep}
      connectionRadius={32}
      fitView
      minZoom={0.2}
      maxZoom={2}
    >
      <Background color="#cfcfcf" gap={20} />
      <Controls />
    </ReactFlow>
  );
}
