"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ReactFlow,
  type Connection,
} from "@xyflow/react";
import { EdgeBridgeRenderContext } from "@/components/editor/edges/FlowEdge";
import { flowEdgeComponents } from "@/components/editor/edges";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { createFlowEditorEdge } from "@/features/flow/flow-edge-factory";
import type {
  AutoLayoutEdge,
  AutoLayoutNode,
} from "@/features/flow/auto-layout";
import { flowNodeComponents } from "@/features/flow/components/nodes";
import { FlowNodeRenderProvider } from "@/features/flow/components/nodes/FlowNodeRenderContext";
import type {
  FlowEditorEdge,
  FlowEditorNode,
} from "@/types/flow";

export type LayoutDebugDiagram = {
  nodes: AutoLayoutNode[];
  edges: AutoLayoutEdge[];
};

export type LayoutDebugExercise = {
  diagrams: Array<{
    generated: LayoutDebugDiagram | null;
    name: string;
    reference: LayoutDebugDiagram | null;
  }>;
  id: string;
  importError: string | null;
  title: string;
};

const fitViewOptions = {
  duration: 0,
  maxZoom: 1.05,
  minZoom: 0.18,
  padding: 0.18,
};

const flowNodeRenderContextValue = {
  availableFunctions: [],
  getExecution: () => undefined,
};

const noopLabelChange = () => {};
const noopConfigChange = () => {};
const noopHandlePositionsChange = () => {};

export function LayoutDebugClient({
  exercises,
}: {
  exercises: LayoutDebugExercise[];
}) {
  return (
    <I18nProvider>
      <FlowNodeRenderProvider value={flowNodeRenderContextValue}>
        <EdgeBridgeRenderContext.Provider
          value={{ disabled: true, revision: "layout-debug" }}
        >
          <div className="flex flex-col gap-6">
            {exercises.map((exercise) => (
              <section
                key={exercise.id}
                className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm"
              >
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-950">
                      {exercise.title}
                    </h2>
                    {exercise.importError ? (
                      <p className="mt-1 text-sm font-medium text-red-700">
                        {exercise.importError}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {exercise.diagrams.length} diagramas
                  </p>
                </div>

                <div className="flex flex-col gap-5">
                  {exercise.diagrams.map((diagramPair) => (
                    <div key={diagramPair.name} className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold text-neutral-800">
                        {diagramPair.name}
                      </h3>
                      <div className="grid gap-3 xl:grid-cols-2">
                        <PreviewPanel
                          diagram={diagramPair.reference}
                          title="Referencia JSON"
                        />
                        <PreviewPanel
                          diagram={diagramPair.generated}
                          title="Nuevo auto-layout"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </EdgeBridgeRenderContext.Provider>
      </FlowNodeRenderProvider>
    </I18nProvider>
  );
}

function PreviewPanel({
  diagram,
  title,
}: {
  diagram: LayoutDebugDiagram | null;
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-300 bg-neutral-100">
      <div className="flex items-center justify-between border-b border-neutral-300 bg-neutral-50 px-3 py-2">
        <p className="text-sm font-semibold text-neutral-800">{title}</p>
        <p className="text-xs font-medium text-neutral-500">
          {diagram ? `${diagram.nodes.length} nodos` : "sin datos"}
        </p>
      </div>
      <div className="h-[520px]">
        {diagram ? <FlowPreview diagram={diagram} /> : <MissingDiagram />}
      </div>
    </div>
  );
}

function FlowPreview({ diagram }: { diagram: LayoutDebugDiagram }) {
  const nodes = useMemo(
    () => diagram.nodes.map(toPreviewNode),
    [diagram.nodes],
  );
  const edges = useMemo(
    () => diagram.edges.map(toPreviewEdge),
    [diagram.edges],
  );

  return (
    <ReactFlow<FlowEditorNode, FlowEditorEdge>
      className="flow-editor-canvas bg-neutral-100"
      colorMode="light"
      connectionLineType={ConnectionLineType.SmoothStep}
      edges={edges}
      edgeTypes={flowEdgeComponents}
      fitView
      fitViewOptions={fitViewOptions}
      maxZoom={1.4}
      minZoom={0.12}
      nodes={nodes}
      nodesConnectable={false}
      nodesDraggable={false}
      nodesFocusable={false}
      nodeTypes={flowNodeComponents}
      onlyRenderVisibleElements={false}
      panOnDrag
      proOptions={{ hideAttribution: true }}
      selectNodesOnDrag={false}
      zoomOnDoubleClick={false}
      zoomOnPinch
      zoomOnScroll
    >
      <Background
        color="#d4d4d4"
        gap={24}
        variant={BackgroundVariant.Lines}
      />
    </ReactFlow>
  );
}

function MissingDiagram() {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-sm font-medium text-neutral-500">
      No hay JSON de referencia para este diagrama.
    </div>
  );
}

function toPreviewNode(node: AutoLayoutNode): FlowEditorNode {
  return {
    ...node,
    data: {
      ...node.data,
      onConfigChange: noopConfigChange,
      onHandlePositionsChange: noopHandlePositionsChange,
      onLabelChange: noopLabelChange,
    },
    draggable: false,
    selectable: false,
  } as FlowEditorNode;
}

function toPreviewEdge(edge: AutoLayoutEdge): FlowEditorEdge {
  const connection: Connection = {
    source: edge.source,
    sourceHandle: edge.sourceHandle ?? "out",
    target: edge.target,
    targetHandle: edge.targetHandle ?? "in",
  };

  return createFlowEditorEdge(connection);
}
