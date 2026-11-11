"use client";

import { addEdge, type IsValidConnection, type OnConnect } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flowEdgeComponents } from "@/components/editor/edges";
import { FlowEditor } from "@/components/editor/FlowEditor";
import { ExerciseModePanel } from "@/features/exercises/components/ExerciseModePanel";
import type {
  Exercise,
  ExerciseStarterDiagram,
} from "@/features/exercises/types";
import { createFlowEditorEdge } from "@/features/flow/flow-edge-factory";
import { createFlowEditorNode } from "@/features/flow/flow-node-factory";
import { validateFlowConnection } from "@/features/flow/flow-validation";
import { initialFlowNodes } from "@/features/flow/initial-diagram";
import type { ImportedFlowNode } from "@/features/flow/parser";
import { useI18n } from "@/features/i18n/I18nProvider";
import type {
  FlowFunctionDefinition,
  FlowNodeType,
  FlowProgram,
} from "@/types/flow";
import { FlowCodeTools } from "./FlowCodeTools";
import { FlowActionIcon } from "./FlowActionIcon";
import { FlowDialogModal, type FlowDialogRequest } from "./FlowDialogModal";
import { FlowExecutionHistoryPanel } from "./FlowExecutionHistoryPanel";
import { FlowExecutionPanel } from "./FlowExecutionPanel";
import { FlowExerciseTestPanel } from "./FlowExerciseTestPanel";
import { FlowExportModal } from "./FlowExportModal";
import { FlowFunctionPanel } from "./FlowFunctionPanel";
import { FlowFunctionParameterModal } from "./FlowFunctionParameterModal";
import { FlowInputModal } from "./FlowInputModal";
import { FlowOutputPanel } from "./FlowOutputPanel";
import { FlowProjectPanel } from "./FlowProjectPanel";
import { FlowRecoveryPanel } from "./FlowRecoveryPanel";
import { FlowSidebar } from "./FlowSidebar";
import { FlowSubmissionPanel } from "./FlowSubmissionPanel";
import { FlowValidationPanel } from "./FlowValidationPanel";
import { FlowVariablesPanel } from "./FlowVariablesPanel";
import { flowNodeComponents } from "./nodes";
import { FlowNodeRenderProvider } from "./nodes/FlowNodeRenderContext";
import {
  clearFunctionReferences,
  getNextFunctionCounter,
  getNextNodeCounter,
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
import { useFlowWorkspaceRecovery } from "./workspace/useFlowWorkspaceRecovery";
import { useBlockDisplayPreference } from "./workspace/useBlockDisplayPreference";

type PendingFlowDialog = FlowDialogRequest & {
  onConfirm: () => void;
};

type FlowWorkspaceProps = {
  databaseExercises: Exercise[];
  editingSubmission?: {
    id: number;
    title: string;
    submissionDeadline: string | null;
  };
  initialExerciseId?: string | null;
  initialProgram?: FlowProgram;
  draftStorageKey?: string;
  isReviewMode?: boolean;
  allowSubmissions?: boolean;
  enableProjectSaving?: boolean;
  project?: {
    id: number;
    title: string;
  };
};

export function FlowWorkspace({
  databaseExercises,
  editingSubmission,
  initialExerciseId,
  initialProgram,
  draftStorageKey,
  isReviewMode = false,
  allowSubmissions = true,
  enableProjectSaving = false,
  project,
}: FlowWorkspaceProps) {
  const { language, t } = useI18n();
  const { displayMode: blockDisplayMode, setDisplayMode: setBlockDisplayMode } =
    useBlockDisplayPreference();
  const isEditingSubmission = editingSubmission !== undefined;
  const nextNodeId = useRef(initialFlowNodes.length);
  const nextFunctionId = useRef(0);
  const hasLoadedInitialProgramRef = useRef(false);
  const [programReady, setProgramReady] = useState(!initialProgram);
  const loadedExerciseStarterCodeRef = useRef<string | null>(null);
  const [blockedConnectionMessage, setBlockedConnectionMessage] = useState<
    string | null
  >(null);
  const [dialogRequest, setDialogRequest] = useState<PendingFlowDialog | null>(
    null,
  );
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    initialExerciseId ?? null,
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
    if (isEditingSubmission) {
      return;
    }

    setSelectedExerciseId(null);
    loadedExerciseStarterCodeRef.current = null;
  }, [isEditingSubmission]);
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
      databaseExercises,
      language,
      loadedExerciseStarterCodeRef,
      loadStarterDiagram,
      requestReplaceConfirmation,
      resetCodeGeneration,
      selectedExerciseId,
      setBlockedConnectionMessage,
      setIsAutoRunning,
      setSelectedExerciseId,
    });

  const loadProgramForReview = useCallback(
    (program: FlowProgram) => {
      const reviewMain = {
        nodes: program.main.nodes.map((node) =>
          createEditorNodeFromImport(node as ImportedFlowNode),
        ),
        edges: program.main.edges,
      };
      const reviewFunctions = program.functions.map((flowFunction) => ({
        ...flowFunction,
        nodes: flowFunction.nodes.map((node) =>
          createEditorNodeFromImport(node as ImportedFlowNode),
        ),
      }));

      setActiveDiagramId("main");
      setMainDiagram(reviewMain);
      setFunctions(reviewFunctions);
      setNodes(reviewMain.nodes);
      setEdges(reviewMain.edges);
      setIsAutoRunning(false);
      resetExecutionForDiagram("main", t("flow.main"));
      nextNodeId.current = getNextNodeCounter({
        main: reviewMain,
        functions: reviewFunctions,
      });
      nextFunctionId.current = getNextFunctionCounter({
        main: reviewMain,
        functions: reviewFunctions,
      });
    },
    [
      createEditorNodeFromImport,
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

  useEffect(() => {
    if (!initialProgram || hasLoadedInitialProgramRef.current) {
      return;
    }

    hasLoadedInitialProgramRef.current = true;
    loadProgramForReview(initialProgram);
    setProgramReady(true);
  }, [initialProgram, loadProgramForReview]);

  const restoreWorkspace = useCallback(
    ({
      snapshot,
      program,
    }: {
      snapshot: { activeDiagramId: string; exerciseId: string | null };
      program: FlowProgram;
    }) => {
      loadProgramForReview(program);
      const diagram = program.functions.find(
        (item) => item.id === snapshot.activeDiagramId,
      );
      if (diagram) {
        setActiveDiagramId(diagram.id);
        setNodes(diagram.nodes);
        setEdges(diagram.edges);
        resetExecutionForDiagram(
          diagram.id,
          `${t("flow.function")} ${diagram.name}`,
        );
      }
      if (!isEditingSubmission) setSelectedExerciseId(snapshot.exerciseId);
      loadedExerciseStarterCodeRef.current = null;
      setBlockedConnectionMessage(null);
      setCodeGenerationResult(initialCodeGenerationResult);
    },
    [
      isEditingSubmission,
      loadProgramForReview,
      resetExecutionForDiagram,
      setActiveDiagramId,
      setCodeGenerationResult,
      setEdges,
      setNodes,
      t,
    ],
  );
  const requestLeaveConfirmation = useCallback(
    (proceed: () => void) => {
      setDialogRequest({
        title: language === "es" ? "¿Salir del editor?" : "Leave the editor?",
        message:
          language === "es"
            ? "Tienes cambios pendientes. Puedes cancelar para guardar o entregar tu trabajo antes de salir."
            : "You have unsaved changes. Cancel to save or submit your work before leaving.",
        confirmLabel: language === "es" ? "Salir" : "Leave",
        onConfirm: proceed,
      });
    },
    [language],
  );
  const recovery = useFlowWorkspaceRecovery({
    activeDiagramId,
    currentProgram,
    selectedExerciseId,
    storageKey: draftStorageKey,
    ready: programReady,
    enabled: !isReviewMode,
    createEditorNodeFromImport,
    onRestore: restoreWorkspace,
    onRequestLeave: requestLeaveConfirmation,
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
    <div className="flow-workspace flex w-full min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="workspace-eyebrow text-emerald-700">
            {isReviewMode
              ? language === "es"
                ? "REVISIÓN"
                : "REVIEW"
              : "WORKSPACE"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
            {project?.title ??
              editingSubmission?.title ??
              (language === "es" ? "Editor de algoritmos" : "Algorithm editor")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {language === "es"
              ? "Construye, conecta y comprende cada paso."
              : "Build, connect, and understand every step."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="workspace-pill border border-slate-200 bg-white text-slate-600">
            <span
              aria-hidden="true"
              className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500"
            />
            JavaScript
          </span>
          <a
            href="#workspace-blocks"
            className="fc-button fc-button--secondary lg:hidden"
          >
            {language === "es" ? "Agregar bloques" : "Add blocks"}
          </a>
        </div>
      </header>
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
      <section className="workspace-grid grid w-full min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[224px_minmax(0,1fr)] xl:grid-cols-[224px_minmax(0,1fr)_256px] 2xl:grid-cols-[240px_minmax(0,1fr)_280px]">
        <div
          id="workspace-blocks"
          className="workspace-library order-2 flex min-w-0 scroll-mt-24 flex-col gap-4 lg:order-1"
        >
          <a
            href="#workspace-canvas"
            className="fc-button fc-button--secondary lg:hidden"
          >
            {language === "es" ? "Volver al diagrama" : "Back to diagram"}
          </a>
          <FlowSidebar
            onAddNode={handleAddNode}
            displayMode={blockDisplayMode}
            onDisplayModeChange={setBlockDisplayMode}
          />
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
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
          {!isReviewMode ? <FlowRecoveryPanel recovery={recovery} /> : null}
          <ExerciseModePanel
            exercises={exerciseCatalog}
            selectedExercise={selectedExercise}
            onSelectExercise={handleSelectExercise}
            showExerciseSelector={!isEditingSubmission}
          />
          <div
            id="workspace-canvas"
            className="workspace-canvas flex h-[min(76vh,840px)] min-h-[600px] min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40"
          >
            <div className="canvas-header border-b border-slate-200 bg-slate-50/80 p-4">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-emerald-700 shadow-sm"
                  >
                    <FlowActionIcon action="diagram" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {t("flow.diagram")} {activeDiagramName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {t("flow.diagramHelp")}
                    </p>
                  </div>
                </div>
                <span className="workspace-pill shrink-0 border border-slate-200 bg-white text-slate-600">
                  {t("flow.blockCount", { count: nodes.length })}
                </span>
              </div>
              <div className="canvas-toolbar mt-3 flex min-w-0 flex-wrap items-center gap-2">
                {!isReviewMode ? (
                  <div
                    role="group"
                    aria-label={
                      language === "es"
                        ? "Historial de edición"
                        : "Edit history"
                    }
                    className="canvas-toolbar-group"
                  >
                    <button
                      type="button"
                      onClick={recovery.undo}
                      disabled={!recovery.canUndo}
                      title={
                        language === "es"
                          ? "Deshacer (Ctrl/Cmd+Z)"
                          : "Undo (Ctrl/Cmd+Z)"
                      }
                      className="fc-button fc-button--secondary !px-2.5 !text-xs"
                    >
                      <FlowActionIcon action="undo" />
                      {language === "es" ? "Deshacer" : "Undo"}
                    </button>
                    <button
                      type="button"
                      onClick={recovery.redo}
                      disabled={!recovery.canRedo}
                      title={
                        language === "es"
                          ? "Rehacer (Ctrl/Cmd+Shift+Z)"
                          : "Redo (Ctrl/Cmd+Shift+Z)"
                      }
                      className="fc-button fc-button--secondary !px-2.5 !text-xs"
                    >
                      <FlowActionIcon action="redo" />
                      {language === "es" ? "Rehacer" : "Redo"}
                    </button>
                  </div>
                ) : null}
                <div
                  role="group"
                  aria-label={
                    language === "es"
                      ? "Archivos del diagrama"
                      : "Diagram files"
                  }
                  className="canvas-toolbar-group"
                >
                  <button
                    type="button"
                    onClick={handleImportJsonButtonClick}
                    className="fc-button fc-button--secondary !px-2.5 !text-xs"
                  >
                    <FlowActionIcon action="import" />
                    {t("flow.importJson")}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenExportModal}
                    className="fc-button fc-button--secondary !px-2.5 !text-xs"
                  >
                    <FlowActionIcon action="export" />
                    {t("flow.export")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleClearActiveDiagram}
                  disabled={!hasActiveDiagramContent}
                  className="fc-button fc-button--danger !px-2.5 !text-xs"
                >
                  <FlowActionIcon action="clear" />
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
                      {nodes.length === 0 ? (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
                          <div className="max-w-xs text-center">
                            <div
                              aria-hidden="true"
                              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-600 shadow-sm"
                            >
                              <svg
                                width="34"
                                height="34"
                                viewBox="0 0 34 34"
                                fill="none"
                              >
                                <rect
                                  x="8"
                                  y="2"
                                  width="18"
                                  height="10"
                                  rx="5"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                />
                                <path
                                  d="M17 12v8m-3-3 3 3 3-3"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <rect
                                  x="5"
                                  y="22"
                                  width="24"
                                  height="10"
                                  rx="2"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                />
                              </svg>
                            </div>
                            <h2 className="text-base font-semibold text-slate-800">
                              {language === "es"
                                ? "Todo comienza con una idea"
                                : "Every flow starts with an idea"}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-slate-500">
                              {language === "es"
                                ? "Agrega tu primer bloque y conecta los pasos de tu algoritmo."
                                : "Add your first block and connect the steps of your algorithm."}
                            </p>
                            <button
                              type="button"
                              className="fc-button fc-button--primary pointer-events-auto mt-5"
                              onClick={() => handleAddNode("start")}
                            >
                              {language === "es"
                                ? "Crear primer bloque"
                                : "Create first block"}
                              <span aria-hidden="true">＋</span>
                            </button>
                          </div>
                        </div>
                      ) : null}
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
                        <FlowVariablesPanel
                          variables={executionState.variables}
                        />
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
                        displayMode={blockDisplayMode}
                        onDisplayModeChange={setBlockDisplayMode}
                      />
                    ),
                  }}
                />
              </FlowNodeRenderProvider>
            </div>
          </div>

          {!isReviewMode ? (
            <FlowExerciseTestPanel
              currentProgram={currentProgram}
              selectedExercise={selectedExercise}
            />
          ) : null}
          <FlowCodeTools
            generatedCode={codeGenerationResult.code}
            generatedWarnings={codeGenerationResult.warnings}
            onGenerateCode={handleGenerateCode}
            importCode={importCode}
            importMessage={importMessage}
            importStatus={importStatus}
            importWarnings={importWarnings}
            onImportCodeChange={setImportCode}
            onImportCode={handleImportCode}
          />
          {!isReviewMode && enableProjectSaving ? (
            <FlowProjectPanel
              currentProgram={currentProgram}
              project={project}
              onSaved={recovery.markSaved}
            />
          ) : null}
          {!isReviewMode && allowSubmissions ? (
            <FlowSubmissionPanel
              currentProgram={currentProgram}
              editingSubmission={editingSubmission}
              selectedExercise={selectedExercise}
              onSaved={recovery.markSaved}
            />
          ) : null}
        </div>

        <aside className="order-3 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2 xl:col-span-1 xl:flex xl:flex-col">
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
    </div>
  );
}
