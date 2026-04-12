"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  type EdgeTypes,
  type IsValidConnection,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import type { FlowEditorEdge, FlowEditorNode } from "@/types/flow";

const fitViewOptions = {
  padding: 0.24,
  minZoom: 0.35,
  maxZoom: 1.15,
  duration: 300,
};

function getMiniMapNodeColor(node: FlowEditorNode) {
  if (node.type === "start") {
    return "#bbf7d0";
  }

  if (node.type === "end") {
    return "#fecaca";
  }

  if (node.type === "decision") {
    return "#a5f3fc";
  }

  if (node.type === "input") {
    return "#bae6fd";
  }

  if (node.type === "output") {
    return "#fde68a";
  }

  if (node.type === "functionCall") {
    return "#ddd6fe";
  }

  if (node.type === "return") {
    return "#fecdd3";
  }

  return "#f5f5f5";
}

function getMiniMapNodeStrokeColor(node: FlowEditorNode) {
  if (node.type === "start") {
    return "#059669";
  }

  if (node.type === "end") {
    return "#b91c1c";
  }

  if (node.type === "decision") {
    return "#0891b2";
  }

  if (node.type === "input") {
    return "#0369a1";
  }

  if (node.type === "output") {
    return "#b45309";
  }

  if (node.type === "functionCall") {
    return "#7c3aed";
  }

  if (node.type === "return") {
    return "#be123c";
  }

  return "#525252";
}

type FlowEditorProps = {
  nodes: FlowEditorNode[];
  edges: FlowEditorEdge[];
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  onNodesChange: OnNodesChange<FlowEditorNode>;
  onEdgesChange: OnEdgesChange<FlowEditorEdge>;
  onConnect: OnConnect;
  isValidConnection: IsValidConnection<FlowEditorEdge>;
};

export function FlowEditor({
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
}: FlowEditorProps) {
  return (
    <ReactFlow<FlowEditorNode, FlowEditorEdge>
      className="flow-editor-canvas h-full min-h-[520px] bg-neutral-100 [&_.react-flow__pane]:cursor-grab [&_.react-flow__pane.dragging]:cursor-grabbing"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      connectionMode={ConnectionMode.Loose}
      connectionLineType={ConnectionLineType.SmoothStep}
      connectionRadius={32}
      connectionDragThreshold={6}
      fitView
      fitViewOptions={fitViewOptions}
      minZoom={0.18}
      maxZoom={2.2}
      nodesDraggable
      selectNodesOnDrag={false}
      nodeDragThreshold={3}
      nodeClickDistance={3}
      panOnDrag={[0, 1, 2]}
      panActivationKeyCode="Space"
      selectionKeyCode="Shift"
      selectionOnDrag={false}
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      panOnScroll={false}
      autoPanOnNodeDrag
      autoPanOnConnect
      autoPanSpeed={16}
      elevateNodesOnSelect
      elevateEdgesOnSelect
      snapToGrid={false}
      snapGrid={[20, 20]}
      onlyRenderVisibleElements
      attributionPosition="top-right"
    >
      <Background
        variant={BackgroundVariant.Lines}
        color="#d4d4d4"
        gap={24}
      />
      <Controls
        position="bottom-left"
        showFitView
        fitViewOptions={fitViewOptions}
        className="!rounded-md !border !border-neutral-300 !bg-white !shadow-sm"
        aria-label="Controles del diagrama"
      />
      <MiniMap<FlowEditorNode>
        position="bottom-right"
        pannable
        zoomable
        nodeColor={getMiniMapNodeColor}
        nodeStrokeColor={getMiniMapNodeStrokeColor}
        nodeStrokeWidth={3}
        nodeBorderRadius={4}
        bgColor="#fafafa"
        maskColor="rgba(245, 245, 245, 0.72)"
        maskStrokeColor="#525252"
        maskStrokeWidth={1}
        offsetScale={8}
        zoomStep={12}
        ariaLabel="Mini mapa del diagrama"
        className="!h-32 !w-48 !rounded-md !border !border-neutral-300 !bg-white !shadow-md"
      />
    </ReactFlow>
  );
}
