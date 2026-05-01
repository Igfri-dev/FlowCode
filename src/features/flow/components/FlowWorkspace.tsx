"use client";

import { useCallback, useRef, useState } from "react";
import {
  addEdge,
  type IsValidConnection,
  type OnConnect,
} from "@xyflow/react";
import { FlowEditor } from "@/components/editor/FlowEditor";
import { flowEdgeComponents } from "@/components/editor/edges";
import { ExerciseModePanel } from "@/features/exercises/components/ExerciseModePanel";
import type { ExerciseStarterDiagram } from "@/features/exercises/types";
import { useI18n } from "@/features/i18n/I18nProvider";
import { createFlowEditorEdge } from "@/features/flow/flow-edge-factory";
import { createFlowEditorNode } from "@/features/flow/flow-node-factory";
import { validateFlowConnection } from "@/features/flow/flow-validation";
import { initialFlowNodes } from "@/features/flow/initial-diagram";
import type {
  FlowFunctionDefinition,
  FlowNodeType,
  FlowProgram,
} from "@/types/flow";
import { FlowCodePanel } from "./FlowCodePanel";
import {
  FlowDialogModal,
  type FlowDialogRequest,
} from "./FlowDialogModal";
import { FlowExecutionHistoryPanel } from "./FlowExecutionHistoryPanel";
import { FlowExecutionPanel } from "./FlowExecutionPanel";
import { FlowExportModal } from "./FlowExportModal";
import { FlowFunctionPanel } from "./FlowFunctionPanel";
import { FlowFunctionParameterModal } from "./FlowFunctionParameterModal";
import { FlowImportPanel } from "./FlowImportPanel";
import { FlowInputModal } from "./FlowInputModal";
import { FlowOutputPanel } from "./FlowOutputPanel";
import { FlowSidebar } from "./FlowSidebar";
import { FlowValidationPanel } from "./FlowValidationPanel";
import { FlowVariablesPanel } from "./FlowVariablesPanel";
import { flowNodeComponents } from "./nodes";
import { FlowNodeRenderProvider } from "./nodes/FlowNodeRenderContext";
import {
  clearFunctionReferences,
} from "./workspace/flowWorkspaceSerialization";
import { useFlowDragPositioning } from "./workspace/useFlowDragPositioning";
import { useFlowExecution } from "./workspace/useFlowExecution";
import { useFlowExerciseMode } from "./workspace/useFlowExerciseMode";
import {
  initialCodeGenerationResult,
  useFlowImportExport,
} from "./workspace/useFlowImportExport";
import {
  createEditorEdgeFromStarter,
  useFlowNodeEditing,
} from "./workspace/useFlowNodeEditing";
import { useFlowProgramState } from "./workspace/useFlowProgramState";

type PendingFlowDialog = FlowDialogRequest & {
  onConfirm: () => void;
};

export function FlowWorkspace() {
  const { language, t } = useI18n();
  const nextNodeId = useRef(initialFlowNodes.length);
  const nextFunctionId = useRef(0);
  const loadedExerciseStarterCodeRef = useRef<string | null>(null);
  const [blockedConnectionMessage, setBlockedConnectionMessage] = useState<
    string | null
  >(null);
  const [dialogRequest, setDialogRequest] =
    useState<PendingFlowDialog | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );
  const {
    activeDiagramId,
    activeDiagramName,
    analysisNodes,
    availableFunctions,
    currentProgram,
    edges,
    functions,
    hasActiveDiagramContent,
    hasLoops,
    nodes,
    onEdgesChange,
    setActiveDiagramId,
    setEdges,
    setFunctions,
    setMainDiagram,
    setNodes,
    validationIssues,
  } = useFlowProgramState({ t });
  const {
    createEditorNodeFromImport,
    createEditorNodeFromStarter,
    createFunctionDefinitionFromImport,
    createFunctionDefinitionFromStarter,
    handleNodeConfigChange,
    handleNodeHandlePositionsChange,
    handleNodeLabelChange,
  } = useFlowNodeEditing({
    language,
    setNodes,
  });
  const {
    executionState,
    flowNodeRenderContextValue,
    handleFunctionParameterConfirm,
    handleInputConfirm,
    handlePauseExecution,
    handleResetExecution,
    handleRunExecution,
    handleStepExecution,
    isAutoExecutionActive,
    renderedEdges,
    resetExecutionForDiagram,
    setIsAutoRunning,
  } = useFlowExecution({
    activeDiagramId,
    activeDiagramName,
    availableFunctions,
    currentProgram,
    edges,
    t,
  });
  const requestReplaceConfirmation = useCallback(
    (onConfirm: () => void) => {
      setDialogRequest({
        title: t("flow.replaceDialogTitle"),
        message: t("flow.replaceDialogMessage"),
        confirmLabel: t("flow.replace"),
        tone: "warning",
        onConfirm,
      });
    },
    [t],
  );
  const clearExerciseSelection = useCallback(() => {
    setSelectedExerciseId(null);
    loadedExerciseStarterCodeRef.current = null;
  }, []);
  const {
    codeGenerationResult,
    editorShellRef,
    exportError,
    handleCloseExportModal,
    handleExportDiagram,
    handleGenerateCode,
    handleImportCode,
    handleImportJsonButtonClick,
    handleImportJsonFileChange,
    handleOpenExportModal,
    importCode,
    importJsonInputRef,
    importMessage,
    importStatus,
    importWarnings,
    isExportModalOpen,
    isExporting,
    resetCodeGeneration,
    setCodeGenerationResult,
    setImportCode,
    setImportMessage,
    setImportStatus,
    setImportWarnings,
  } = useFlowImportExport({
    activeDiagramId,
    createEditorNodeFromImport,
    createFunctionDefinitionFromImport,
    currentProgram,
    nextFunctionIdRef: nextFunctionId,
    nextNodeIdRef: nextNodeId,
    nodes,
    onClearExerciseSelection: clearExerciseSelection,
    requestReplaceConfirmation,
    resetExecutionForDiagram,
    setActiveDiagramId,
    setBlockedConnectionMessage,
    setEdges,
    setFunctions,
    setIsAutoRunning,
    setMainDiagram,
    setNodes,
    t,
  });
  const { handleNodeDragStart, handleNodeDragStop, handleNodesChange } =
    useFlowDragPositioning({
      edges,
      setNodes,
    });

  const handleDialogCancel = useCallback(() => {
    setDialogRequest(null);
  }, []);

  const handleDialogConfirm = useCallback(() => {
    if (!dialogRequest) {
      return;
    }

    setDialogRequest(null);
    dialogRequest.onConfirm();
  }, [dialogRequest]);

  const loadStarterDiagram = useCallback(
    (starterDiagram: ExerciseStarterDiagram) => {
      const starterNodes = starterDiagram.main.nodes.map(
        createEditorNodeFromStarter,
      );
      const starterEdges = starterDiagram.main.edges.map(
        createEditorEdgeFromStarter,
      );
      const starterFunctions = (starterDiagram.functions ?? []).map(
        createFunctionDefinitionFromStarter,
      );
      const nextMainDiagram = {
        nodes: starterNodes,
        edges: starterEdges,
      };
      const loadedNodeCount =
        starterNodes.length +
        starterFunctions.reduce(
          (count, flowFunction) => count + flowFunction.nodes.length,
          0,
        );

      setActiveDiagramId("main");
      setMainDiagram(nextMainDiagram);
      setFunctions(starterFunctions);
      setNodes(nextMainDiagram.nodes);
      setEdges(nextMainDiagram.edges);
      resetExecutionForDiagram("main", t("flow.main"));
      nextNodeId.current = loadedNodeCount;
    },
    [
      createEditorNodeFromStarter,
      createFunctionDefinitionFromStarter,
      resetExecutionForDiagram,
      setActiveDiagramId,
      setEdges,
      setFunctions,
      setMainDiagram,
      setNodes,
      t,
    ],
  );
  const { exerciseCatalog, handleSelectExercise, selectedExercise } =
    useFlowExerciseMode({
      currentProgram,
      importCode,
      language,
      loadedExerciseStarterCodeRef,
      loadStarterDiagram,
      requestReplaceConfirmation,
      resetCodeGeneration,
      selectedExerciseId,
      setBlockedConnectionMessage,
      setImportCode,
      setImportMessage,
      setImportStatus,
      setImportWarnings,
      setIsAutoRunning,
      setSelectedExerciseId,
      t,
    });

  const handleAddNode = useCallback(
    (type: FlowNodeType) => {
      setBlockedConnectionMessage(null);
      setIsAutoRunning(false);
      resetExecutionForDiagram(activeDiagramId, activeDiagramName);
      setNodes((currentNodes) => {
        nextNodeId.current += 1;

        const node = createFlowEditorNode({
          id: `${type}-${nextNodeId.current}`,
          type,
          index: currentNodes.length,
          onLabelChange: handleNodeLabelChange,
          onConfigChange: handleNodeConfigChange,
          onHandlePositionsChange: handleNodeHandlePositionsChange,
          language,
        });

        return [...currentNodes, node];
      });
    },
    [
      activeDiagramId,
      activeDiagramName,
      handleNodeConfigChange,
      handleNodeHandlePositionsChange,
      handleNodeLabelChange,
      language,
      resetExecutionForDiagram,
      setIsAutoRunning,
      setNodes,
    ],
  );

  const handleClearActiveDiagram = useCallback(() => {
    if (!hasActiveDiagramContent) {
      return;
    }

    const clearActiveDiagram = () => {
      const emptyDiagram: FlowProgram["main"] = {
        nodes: [],
        edges: [],
      };

      setBlockedConnectionMessage(null);
      setIsAutoRunning(false);
      setCodeGenerationResult(initialCodeGenerationResult);
      resetExecutionForDiagram(activeDiagramId, activeDiagramName);
      setNodes(emptyDiagram.nodes);
      setEdges(emptyDiagram.edges);

      if (activeDiagramId === "main") {
        setMainDiagram(emptyDiagram);
        return;
      }

      setMainDiagram(currentProgram.main);
      setFunctions(
        currentProgram.functions.map((flowFunction) =>
          flowFunction.id === activeDiagramId
            ? {
                ...flowFunction,
                ...emptyDiagram,
              }
            : flowFunction,
        ),
      );
    };

    setDialogRequest({
      title: t("flow.clearDialogTitle", { name: activeDiagramName }),
      message: t("flow.clearDialogMessage"),
      confirmLabel: t("flow.clear"),
      tone: "danger",
      onConfirm: clearActiveDiagram,
    });
  }, [
    activeDiagramId,
    activeDiagramName,
    currentProgram.functions,
    currentProgram.main,
    hasActiveDiagramContent,
    resetExecutionForDiagram,
    setCodeGenerationResult,
    setEdges,
    setFunctions,
    setIsAutoRunning,
    setMainDiagram,
    setNodes,
    t,
  ]);

  const handleConnect = useCallback<OnConnect>(
    (connection) => {
      const validationIssuesForConnection = validateFlowConnection({
        nodes: analysisNodes,
        edges,
        connection,
      });

      if (validationIssuesForConnection.length > 0) {
        setBlockedConnectionMessage(validationIssuesForConnection[0].message);
        return;
      }

      setBlockedConnectionMessage(null);
      setIsAutoRunning(false);
      resetExecutionForDiagram(activeDiagramId, activeDiagramName);

      setEdges((currentEdges) =>
        addEdge(createFlowEditorEdge(connection), currentEdges),
      );
    },
    [
      activeDiagramId,
      activeDiagramName,
      analysisNodes,
      edges,
      resetExecutionForDiagram,
      setEdges,
      setIsAutoRunning,
    ],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) =>
      validateFlowConnection({
        nodes: analysisNodes,
        edges,
        connection,
      }).length === 0,
    [analysisNodes, edges],
  );

  const handleSelectDiagram = useCallback(
    (diagramId: string) => {
      const nextDiagram =
        diagramId === "main"
          ? currentProgram.main
          : currentProgram.functions.find(
              (flowFunction) => flowFunction.id === diagramId,
            );

      if (!nextDiagram) {
        return;
      }

      setMainDiagram(currentProgram.main);
      setFunctions(currentProgram.functions);
      setActiveDiagramId(diagramId);
      setNodes(nextDiagram.nodes);
      setEdges(nextDiagram.edges);
      setIsAutoRunning(false);
      resetExecutionForDiagram(
        diagramId,
        diagramId === "main"
          ? t("flow.main")
          : `${t("flow.function")} ${
              currentProgram.functions.find(
                (flowFunction) => flowFunction.id === diagramId,
              )?.name ?? t("flow.unnamed")
            }`,
      );
    },
    [
      currentProgram,
      resetExecutionForDiagram,
      setActiveDiagramId,
      setEdges,
      setFunctions,
      setIsAutoRunning,
      setMainDiagram,
      setNodes,
      t,
    ],
  );

  const handleCreateFunction = useCallback(() => {
    const functionIndex = currentProgram.functions.length + 1;
    nextFunctionId.current += 1;

    const flowFunction: FlowFunctionDefinition = {
      id: `function-${nextFunctionId.current}`,
      name: `${t("flow.defaultFunctionPrefix")}${functionIndex}`,
      parameters: [],
      nodes: [],
      edges: [],
    };

    setMainDiagram(currentProgram.main);
    setFunctions([...currentProgram.functions, flowFunction]);
    setActiveDiagramId(flowFunction.id);
    setNodes(flowFunction.nodes);
    setEdges(flowFunction.edges);
    setIsAutoRunning(false);
    resetExecutionForDiagram(
      flowFunction.id,
      `${t("flow.function")} ${flowFunction.name}`,
    );
  }, [
    currentProgram,
    resetExecutionForDiagram,
    setActiveDiagramId,
    setEdges,
    setFunctions,
    setIsAutoRunning,
    setMainDiagram,
    setNodes,
    t,
  ]);

  const handleUpdateFunction = useCallback(
    (
      functionId: string,
      changes: Pick<FlowFunctionDefinition, "name" | "parameters">,
    ) => {
      setFunctions((currentFunctions) =>
        currentFunctions.map((flowFunction) => {
          if (flowFunction.id !== functionId) {
            return flowFunction;
          }

          const parametersChanged =
            changes.parameters.join("\u0000") !==
            flowFunction.parameters.join("\u0000");

          return {
            ...flowFunction,
            ...changes,
            parameterDefinitions: parametersChanged
              ? undefined
              : flowFunction.parameterDefinitions,
            nodes: activeDiagramId === functionId ? nodes : flowFunction.nodes,
            edges: activeDiagramId === functionId ? edges : flowFunction.edges,
          };
        }),
      );
    },
    [activeDiagramId, edges, nodes, setFunctions],
  );

  const handleDeleteFunction = useCallback(
    (functionId: string) => {
      const nextMainDiagram = {
        ...currentProgram.main,
        nodes: clearFunctionReferences(currentProgram.main.nodes, functionId),
      };
      const nextFunctions = currentProgram.functions
        .filter((flowFunction) => flowFunction.id !== functionId)
        .map((flowFunction) => ({
          ...flowFunction,
          nodes: clearFunctionReferences(flowFunction.nodes, functionId),
        }));

      setBlockedConnectionMessage(null);
      setIsAutoRunning(false);
      setMainDiagram(nextMainDiagram);
      setFunctions(nextFunctions);

      if (activeDiagramId === functionId || activeDiagramId === "main") {
        setActiveDiagramId("main");
        setNodes(nextMainDiagram.nodes);
        setEdges(nextMainDiagram.edges);
        resetExecutionForDiagram("main", t("flow.main"));
        return;
      }

      const activeFunction = nextFunctions.find(
        (flowFunction) => flowFunction.id === activeDiagramId,
      );

      if (!activeFunction) {
        return;
      }

      setNodes(activeFunction.nodes);
      setEdges(activeFunction.edges);
      resetExecutionForDiagram(
        activeFunction.id,
        `${t("flow.function")} ${activeFunction.name}`,
      );
    },
    [
      activeDiagramId,
      currentProgram,
      resetExecutionForDiagram,
      setActiveDiagramId,
      setEdges,
      setFunctions,
      setIsAutoRunning,
      setMainDiagram,
      setNodes,
      t,
    ],
  );

  return (
    <>
      <input
        ref={importJsonInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label={t("flow.importJsonAria")}
        onChange={(event) => {
          void handleImportJsonFileChange(event);
        }}
      />
      <section className="grid min-h-[calc(100vh-6rem)] w-full grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px] 2xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <FlowValidationPanel
            issues={validationIssues}
            hasLoops={hasLoops}
            blockedConnectionMessage={blockedConnectionMessage}
          />
          <FlowFunctionPanel
            activeDiagramId={activeDiagramId}
            functions={functions}
            onSelectDiagram={handleSelectDiagram}
            onCreateFunction={handleCreateFunction}
            onUpdateFunction={handleUpdateFunction}
            onDeleteFunction={handleDeleteFunction}
          />
          <FlowSidebar onAddNode={handleAddNode} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <ExerciseModePanel
            exercises={exerciseCatalog}
            selectedExercise={selectedExercise}
            onSelectExercise={handleSelectExercise}
          />
          <div className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-300/80 bg-white shadow-lg shadow-neutral-300/50">
            <div className="flex min-h-12 flex-col gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  {t("flow.diagram")} {activeDiagramName}
                </p>
                <p className="text-xs text-neutral-500">
                  {t("flow.diagramHelp")}
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={handleImportJsonButtonClick}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
                >
                  {t("flow.importJson")}
                </button>
                <button
                  type="button"
                  onClick={handleOpenExportModal}
                  className="rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
                >
                  {t("flow.export")}
                </button>
                <button
                  type="button"
                  onClick={handleClearActiveDiagram}
                  disabled={!hasActiveDiagramContent}
                  className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition-all hover:-translate-y-px hover:border-red-300 hover:bg-red-50 hover:text-red-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                >
                  {t("flow.clear")}
                </button>
                <FlowExecutionPanel
                  executionState={executionState}
                  isAutoRunning={isAutoExecutionActive}
                  onStep={handleStepExecution}
                  onRun={handleRunExecution}
                  onPause={handlePauseExecution}
                  onReset={handleResetExecution}
                />
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
                  {t("flow.blockCount", { count: nodes.length })}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 bg-neutral-100">
              <FlowNodeRenderProvider value={flowNodeRenderContextValue}>
                <FlowEditor
                  editorShellRef={editorShellRef}
                  nodes={nodes}
                  edges={renderedEdges}
                  nodeTypes={flowNodeComponents}
                  edgeTypes={flowEdgeComponents}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={handleConnect}
                  onNodeDragStart={handleNodeDragStart}
                  onNodeDragStop={handleNodeDragStop}
                  isValidConnection={isValidConnection}
                  editorOverlays={
                    <>
                      <FlowInputModal
                        pendingInput={executionState.pendingInput}
                        onConfirm={handleInputConfirm}
                      />
                      <FlowFunctionParameterModal
                        pendingFunctionParameters={
                          executionState.pendingFunctionParameters
                        }
                        onConfirm={handleFunctionParameterConfirm}
                      />
                      <FlowDialogModal
                        request={dialogRequest}
                        onCancel={handleDialogCancel}
                        onConfirm={handleDialogConfirm}
                      />
                    </>
                  }
                  fullscreenLeftItems={[
                    {
                      id: "execution",
                      label: t("flow.executionPanel"),
                      buttonLabel: "e",
                      children: (
                        <FlowExecutionPanel
                          executionState={executionState}
                          isAutoRunning={isAutoExecutionActive}
                          layout="vertical"
                          onStep={handleStepExecution}
                          onRun={handleRunExecution}
                          onPause={handlePauseExecution}
                          onReset={handleResetExecution}
                        />
                      ),
                    },
                    {
                      id: "functions",
                      label: t("flow.functionsPanel"),
                      buttonLabel: "f",
                      children: (
                        <FlowFunctionPanel
                          activeDiagramId={activeDiagramId}
                          functions={functions}
                          onSelectDiagram={handleSelectDiagram}
                          onCreateFunction={handleCreateFunction}
                          onUpdateFunction={handleUpdateFunction}
                          onDeleteFunction={handleDeleteFunction}
                        />
                      ),
                    },
                    {
                      id: "validation",
                      label: t("flow.validationPanel"),
                      buttonLabel: "v",
                      children: (
                        <FlowValidationPanel
                          issues={validationIssues}
                          hasLoops={hasLoops}
                          blockedConnectionMessage={blockedConnectionMessage}
                        />
                      ),
                    },
                  ]}
                  fullscreenRightItems={[
                    {
                      id: "variables",
                      label: t("flow.variablesPanel"),
                      buttonLabel: "v",
                      children: (
                        <FlowVariablesPanel variables={executionState.variables} />
                      ),
                    },
                    {
                      id: "outputs",
                      label: t("flow.outputsPanel"),
                      buttonLabel: "s",
                      children: (
                        <FlowOutputPanel outputs={executionState.outputs} />
                      ),
                    },
                    {
                      id: "history",
                      label: t("flow.historyPanel"),
                      buttonLabel: "h",
                      children: (
                        <FlowExecutionHistoryPanel
                          history={executionState.history}
                        />
                      ),
                    },
                  ]}
                  fullscreenBottomItem={{
                    id: "blocks",
                    label: t("flow.blocksPanel"),
                    buttonLabel: "B",
                    children: (
                      <FlowSidebar
                        layout="horizontal"
                        onAddNode={handleAddNode}
                      />
                    ),
                  }}
                />
              </FlowNodeRenderProvider>
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

        <aside className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2 xl:col-span-1 xl:flex xl:flex-col">
          <FlowVariablesPanel variables={executionState.variables} />
          <FlowOutputPanel outputs={executionState.outputs} />
          <FlowExecutionHistoryPanel history={executionState.history} />
        </aside>
      </section>
      <FlowExportModal
        error={exportError}
        isExporting={isExporting}
        isOpen={isExportModalOpen}
        onClose={handleCloseExportModal}
        onExport={(options) => {
          void handleExportDiagram(options);
        }}
      />
    </>
  );
}
