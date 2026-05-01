"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ReactFlow,
  type Connection,
} from "@xyflow/react";
import { EdgeBridgeRenderContext } from "@/components/editor/edges/FlowEdge";
import { flowEdgeComponents } from "@/components/editor/edges";
import {
  applySmartFlowLayout,
  type AutoLayoutEdge,
  type AutoLayoutNode,
} from "@/features/flow/auto-layout";
import { createFlowEditorEdge } from "@/features/flow/flow-edge-factory";
import {
  analyzeFlowLayout,
  type FlowLayoutQualityReport,
} from "@/features/flow/layout-quality";
import { flowNodeComponents } from "@/features/flow/components/nodes";
import { FlowNodeRenderProvider } from "@/features/flow/components/nodes/FlowNodeRenderContext";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import type {
  FlowEditorEdge,
  FlowEditorNode,
} from "@/types/flow";

export type LayoutDebugDiagram = {
  nodes: AutoLayoutNode[];
  edges: AutoLayoutEdge[];
};

export type LayoutDebugExample = {
  code: string;
  codegenWarnings: string[];
  diagram: LayoutDebugDiagram | null;
  expectedImportOk: boolean;
  id: string;
  importError: string | null;
  importWarnings: string[];
  name: string;
  quality: FlowLayoutQualityReport | null;
  validationMessages: string[];
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
  examples,
}: {
  examples: LayoutDebugExample[];
}) {
  const [selectedExampleId, setSelectedExampleId] = useState(
    examples[0]?.id ?? "",
  );
  const [diagramOverrides, setDiagramOverrides] = useState<
    Record<string, LayoutDebugDiagram>
  >({});
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const selectedExample =
    examples.find((example) => example.id === selectedExampleId) ?? examples[0];
  const activeDiagram = selectedExample
    ? diagramOverrides[selectedExample.id] ?? selectedExample.diagram
    : null;
  const activeQuality = useMemo(
    () => (activeDiagram ? analyzeFlowLayout(activeDiagram) : null),
    [activeDiagram],
  );
  const warnings = useMemo(
    () =>
      selectedExample
        ? [
            ...(selectedExample.importError
              ? [`Importacion: ${selectedExample.importError}`]
              : []),
            ...selectedExample.importWarnings.map(
              (warning) => `Importacion: ${warning}`,
            ),
            ...selectedExample.codegenWarnings.map(
              (warning) => `Codegen: ${warning}`,
            ),
            ...selectedExample.validationMessages.map(
              (warning) => `Validacion: ${warning}`,
            ),
            ...(activeQuality?.overlaps.length
              ? [`Layout: ${activeQuality.overlaps.length} solape(s).`]
              : []),
            ...(activeQuality?.handleConflicts.length
              ? [
                  `Layout: ${activeQuality.handleConflicts.length} conflicto(s) de handles.`,
                ]
              : []),
          ]
        : [],
    [activeQuality, selectedExample],
  );

  const handleRegenerateLayout = () => {
    if (!activeDiagram || !selectedExample) {
      return;
    }

    setDiagramOverrides((currentOverrides) => ({
      ...currentOverrides,
      [selectedExample.id]: applySmartFlowLayout(activeDiagram),
    }));
    setCopyStatus(null);
  };

  const handleCopyJson = () => {
    if (!activeDiagram) {
      return;
    }

    void navigator.clipboard.writeText(JSON.stringify(activeDiagram, null, 2));
    setCopyStatus("JSON copiado");
  };

  if (!selectedExample) {
    return (
      <p className="rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-700">
        No hay ejemplos de layout disponibles.
      </p>
    );
  }

  return (
    <I18nProvider>
      <FlowNodeRenderProvider value={flowNodeRenderContextValue}>
        <EdgeBridgeRenderContext.Provider
          value={{ disabled: true, revision: "layout-debug" }}
        >
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="flex min-w-0 flex-col gap-4">
              <section className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm">
                <label
                  htmlFor="layout-debug-example"
                  className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Ejemplo
                </label>
                <select
                  id="layout-debug-example"
                  value={selectedExample.id}
                  onChange={(event) => {
                    setSelectedExampleId(event.target.value);
                    setCopyStatus(null);
                  }}
                  className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >
                  {examples.map((example) => (
                    <option key={example.id} value={example.id}>
                      {example.name}
                    </option>
                  ))}
                </select>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRegenerateLayout}
                    disabled={!activeDiagram}
                    className="rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400"
                  >
                    Regenerar layout
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    disabled={!activeDiagram}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 shadow-sm disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                  >
                    Copiar JSON
                  </button>
                </div>
                {copyStatus ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    {copyStatus}
                  </p>
                ) : null}
              </section>

              <QualityPanel quality={activeQuality} />
              <WarningsPanel warnings={warnings} />
            </aside>

            <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)]">
              <div className="min-w-0 rounded-md border border-neutral-300 bg-white shadow-sm">
                <div className="border-b border-neutral-300 px-3 py-2">
                  <p className="text-sm font-semibold text-neutral-800">
                    Codigo fuente
                  </p>
                </div>
                <pre className="max-h-[680px] overflow-auto p-4 text-xs leading-5 text-neutral-800">
                  <code>{selectedExample.code}</code>
                </pre>
              </div>

              <div className="min-w-0 overflow-hidden rounded-md border border-neutral-300 bg-neutral-100 shadow-sm">
                <div className="flex items-center justify-between border-b border-neutral-300 bg-neutral-50 px-3 py-2">
                  <p className="text-sm font-semibold text-neutral-800">
                    Diagrama resultante
                  </p>
                  <p className="text-xs font-medium text-neutral-500">
                    {activeDiagram
                      ? `${activeDiagram.nodes.length} nodos`
                      : "sin diagrama"}
                  </p>
                </div>
                <div className="h-[680px]">
                  {activeDiagram ? (
                    <FlowPreview diagram={activeDiagram} />
                  ) : (
                    <MissingDiagram />
                  )}
                </div>
              </div>
            </section>
          </div>
        </EdgeBridgeRenderContext.Provider>
      </FlowNodeRenderProvider>
    </I18nProvider>
  );
}

function QualityPanel({
  quality,
}: {
  quality: FlowLayoutQualityReport | null;
}) {
  const items = [
    ["Nodos", quality?.nodeCount ?? 0],
    ["Edges", quality?.edgeCount ?? 0],
    ["Decisiones", quality?.decisionCount ?? 0],
    ["Solapes", quality?.overlaps.length ?? 0],
    ["Handles conflictivos", quality?.handleConflicts.length ?? 0],
  ];

  return (
    <section className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-900">Calidad</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {label}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-neutral-950">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function WarningsPanel({ warnings }: { warnings: string[] }) {
  return (
    <section className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-900">Warnings</h2>
      {warnings.length === 0 ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          Sin warnings detectados.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-neutral-800">
          {warnings.map((warning) => (
            <li
              key={warning}
              className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-950"
            >
              {warning}
            </li>
          ))}
        </ul>
      )}
    </section>
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
      El importador rechazo este fixture, por eso no hay diagrama.
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
