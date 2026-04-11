"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  useEdgesState,
  useNodesState,
  type IsValidConnection,
  type OnConnect,
} from "@xyflow/react";
import { FlowEditor } from "@/components/editor/FlowEditor";
import {
  generateJavaScriptFromFlow,
  type FlowCodeGenerationResult,
} from "@/features/flow/codegen";
import { createFlowEditorEdge } from "@/features/flow/flow-edge-factory";
import {
  initialFlowExecutionState,
  resetFlowExecution,
  stepFlowExecution,
} from "@/features/flow/execution";
import { createFlowGraph, hasFlowCycles } from "@/features/flow/flow-graph";
import {
  createFlowEditorNode,
  getFlowNodeLabelFromConfig,
} from "@/features/flow/flow-node-factory";
import {
  validateFlowConnection,
  validateFlowDiagram,
} from "@/features/flow/flow-validation";
import {
  initialFlowEdges,
  initialFlowNodes,
} from "@/features/flow/initial-diagram";
import {
  importJavaScriptToFlow,
  type ImportedFlowNode,
} from "@/features/flow/parser";
import type {
  FlowEditorEdge,
  FlowEditorNode,
  FlowNodeConfig,
  FlowNodeType,
} from "@/types/flow";
import { FlowCodePanel } from "./FlowCodePanel";
import { FlowExecutionHistoryPanel } from "./FlowExecutionHistoryPanel";
import { FlowExecutionPanel } from "./FlowExecutionPanel";
import { FlowImportPanel } from "./FlowImportPanel";
import { FlowSidebar } from "./FlowSidebar";
import { FlowValidationPanel } from "./FlowValidationPanel";
import { FlowVariablesPanel } from "./FlowVariablesPanel";
import { flowNodeComponents } from "./nodes";

const initialCodeGenerationResult: FlowCodeGenerationResult = {
  code: "",
  warnings: [],
};

type ImportStatus = "idle" | "success" | "error";

export function FlowWorkspace() {
  const nextNodeId = useRef(initialFlowNodes.length);
  const [blockedConnectionMessage, setBlockedConnectionMessage] = useState<
    string | null
  >(null);
  const [executionState, setExecutionState] = useState(
    initialFlowExecutionState,
  );
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [codeGenerationResult, setCodeGenerationResult] = useState(
    initialCodeGenerationResult,
  );
  const [importCode, setImportCode] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<FlowEditorNode>(initialFlowNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<FlowEditorEdge>(initialFlowEdges);
  const graph = useMemo(() => createFlowGraph(nodes, edges), [edges, nodes]);
  const validationIssues = useMemo(
    () => validateFlowDiagram({ nodes, edges }),
    [edges, nodes],
  );
  const hasLoops = useMemo(() => hasFlowCycles(graph), [graph]);
  const canContinueExecution =
    executionState.status !== "finished" && executionState.status !== "error";
  const isAutoExecutionActive = isAutoRunning && canContinueExecution;
  const renderedNodes = useMemo(() => {
    const visitedNodeIds = new Set(
      executionState.history.map((item) => item.nodeId),
    );

    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        execution: {
          isCurrent: node.id === executionState.currentNodeId,
          isVisited: visitedNodeIds.has(node.id),
          activeBranch:
            executionState.activeDecision?.nodeId === node.id
              ? executionState.activeDecision.branch
              : null,
        },
      },
    }));
  }, [
    executionState.activeDecision,
    executionState.currentNodeId,
    executionState.history,
    nodes,
  ]);
  const renderedEdges = useMemo(() => {
    const visitedEdgeIds = new Set(
      executionState.history.flatMap((item) =>
        item.edgeId ? [item.edgeId] : [],
      ),
    );

    return edges.map((edge) => {
      const isActive = edge.id === executionState.activeEdgeId;
      const isVisited = visitedEdgeIds.has(edge.id);

      if (!isActive && !isVisited) {
        return edge;
      }

      const stroke = isActive ? "#ca8a04" : "#059669";

      return {
        ...edge,
        animated: isActive,
        style: {
          ...edge.style,
          stroke,
          strokeWidth: isActive ? 3 : 2.5,
        },
        labelStyle: {
          ...edge.labelStyle,
          fill: isActive ? "#854d0e" : "#047857",
          fontWeight: 700,
        },
        markerEnd:
          edge.markerEnd && typeof edge.markerEnd === "object"
            ? {
                ...edge.markerEnd,
                color: stroke,
              }
            : edge.markerEnd,
      };
    });
  }, [edges, executionState.activeEdgeId, executionState.history]);

  useEffect(() => {
    if (!isAutoExecutionActive) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setExecutionState((currentExecutionState) =>
        stepFlowExecution({
          nodes,
          edges,
          state: currentExecutionState,
        }),
      );
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    edges,
    executionState.stepCount,
    isAutoExecutionActive,
    nodes,
  ]);

  const handleNodeLabelChange = useCallback(
    (nodeId: string, label: string) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  label,
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const handleNodeConfigChange = useCallback(
    (nodeId: string, config: FlowNodeConfig) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  config,
                  label: getFlowNodeLabelFromConfig(
                    node.type,
                    config,
                    node.data.label,
                  ),
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const createEditorNodeFromImport = useCallback(
    (node: ImportedFlowNode): FlowEditorNode =>
      ({
        ...node,
        data: {
          ...node.data,
          onLabelChange: handleNodeLabelChange,
          onConfigChange: handleNodeConfigChange,
        },
      }) as FlowEditorNode,
    [handleNodeConfigChange, handleNodeLabelChange],
  );

  const handleAddNode = useCallback(
    (type: FlowNodeType) => {
      setBlockedConnectionMessage(null);
      setIsAutoRunning(false);
      setExecutionState(resetFlowExecution());
      setNodes((currentNodes) => {
        nextNodeId.current += 1;

        const node = createFlowEditorNode({
          id: `${type}-${nextNodeId.current}`,
          type,
          index: currentNodes.length,
          onLabelChange: handleNodeLabelChange,
          onConfigChange: handleNodeConfigChange,
        });

        return [...currentNodes, node];
      });
    },
    [handleNodeConfigChange, handleNodeLabelChange, setNodes],
  );

  const handleStepExecution = useCallback(() => {
    setIsAutoRunning(false);
    setExecutionState((currentExecutionState) =>
      stepFlowExecution({
        nodes,
        edges,
        state: currentExecutionState,
      }),
    );
  }, [edges, nodes]);

  const handleRunExecution = useCallback(() => {
    setIsAutoRunning(true);
  }, []);

  const handlePauseExecution = useCallback(() => {
    setIsAutoRunning(false);
  }, []);

  const handleResetExecution = useCallback(() => {
    setIsAutoRunning(false);
    setExecutionState(resetFlowExecution());
  }, []);

  const handleGenerateCode = useCallback(() => {
    setCodeGenerationResult(
      generateJavaScriptFromFlow({
        nodes,
        edges,
      }),
    );
  }, [edges, nodes]);

  const handleImportCode = useCallback(() => {
    const importResult = importJavaScriptToFlow(importCode);

    if (!importResult.ok) {
      setImportStatus("error");
      setImportMessage(importResult.message);
      setImportWarnings([]);
      return;
    }

    setBlockedConnectionMessage(null);
    setIsAutoRunning(false);
    setExecutionState(resetFlowExecution());
    setCodeGenerationResult(initialCodeGenerationResult);
    setImportStatus("success");
    setImportMessage("Diagrama generado desde el código JavaScript.");
    setImportWarnings(importResult.warnings);
    nextNodeId.current = importResult.nodes.length;
    setNodes(importResult.nodes.map(createEditorNodeFromImport));
    setEdges(importResult.edges);
  }, [createEditorNodeFromImport, importCode, setEdges, setNodes]);

  const handleConnect = useCallback<OnConnect>(
    (connection) => {
      const validationIssuesForConnection = validateFlowConnection({
        nodes,
        edges,
        connection,
      });

      if (validationIssuesForConnection.length > 0) {
        setBlockedConnectionMessage(validationIssuesForConnection[0].message);
        return;
      }

      setBlockedConnectionMessage(null);
      setIsAutoRunning(false);
      setExecutionState(resetFlowExecution());

      setEdges((currentEdges) =>
        addEdge(createFlowEditorEdge(connection), currentEdges),
      );
    },
    [edges, nodes, setEdges],
  );

  const isValidConnection = useCallback<IsValidConnection<FlowEditorEdge>>(
    (connection) =>
      validateFlowConnection({
        nodes,
        edges,
        connection,
      }).length === 0,
    [edges, nodes],
  );

  return (
    <section className="mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <FlowSidebar onAddNode={handleAddNode} />
        <FlowValidationPanel
          issues={validationIssues}
          hasLoops={hasLoops}
          blockedConnectionMessage={blockedConnectionMessage}
        />
        <FlowExecutionPanel
          executionState={executionState}
          isAutoRunning={isAutoExecutionActive}
          onStep={handleStepExecution}
          onRun={handleRunExecution}
          onPause={handlePauseExecution}
          onReset={handleResetExecution}
        />
        <FlowVariablesPanel variables={executionState.variables} />
        <FlowExecutionHistoryPanel history={executionState.history} />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 shadow-md shadow-neutral-300/60">
          <div className="flex min-h-12 items-center justify-between border-b border-neutral-300 bg-white px-4">
            <div>
              <p className="text-sm font-semibold text-neutral-950">
                Diagrama
              </p>
              <p className="text-xs text-neutral-500">
                Agrega bloques desde la barra lateral
              </p>
            </div>
            <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-600">
              {nodes.length} bloques
            </span>
          </div>

          <div className="min-h-0 flex-1 bg-neutral-100">
            <FlowEditor
              nodes={renderedNodes}
              edges={renderedEdges}
              nodeTypes={flowNodeComponents}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              isValidConnection={isValidConnection}
            />
          </div>
        </div>

        <FlowCodePanel
          code={codeGenerationResult.code}
          warnings={codeGenerationResult.warnings}
          onGenerateCode={handleGenerateCode}
        />
        <FlowImportPanel
          code={importCode}
          message={importMessage}
          status={importStatus}
          warnings={importWarnings}
          onCodeChange={setImportCode}
          onImportCode={handleImportCode}
        />
      </div>
    </section>
  );
}
