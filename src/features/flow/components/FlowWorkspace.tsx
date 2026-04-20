"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  addEdge,
  getNodesBounds,
  getViewportForBounds,
  type Connection,
  useEdgesState,
  useNodesState,
  type IsValidConnection,
  type OnConnect,
} from "@xyflow/react";
import { toJpeg, toPng, toSvg } from "html-to-image";
import { FlowEditor } from "@/components/editor/FlowEditor";
import { flowEdgeComponents } from "@/components/editor/edges";
import { ExerciseModePanel } from "@/features/exercises/components/ExerciseModePanel";
import { getExercises } from "@/features/exercises/data/exercises";
import { useI18n } from "@/features/i18n/I18nProvider";
import type {
  ExerciseStarterDiagram,
  ExerciseStarterEdge,
  ExerciseStarterFunction,
  ExerciseStarterNode,
} from "@/features/exercises/types";
import {
  generateJavaScriptFromFlow,
  type FlowCodeGenerationResult,
} from "@/features/flow/codegen";
import { createFlowEditorEdge } from "@/features/flow/flow-edge-factory";
import { getDefaultFlowNodeHandlePositions } from "@/features/flow/handle-positions";
import {
  initialFlowExecutionState,
  resumeFlowExecutionWithInput,
  resumeFlowExecutionWithFunctionParameters,
  resetFlowExecution,
  stepFlowExecution,
  type FlowExecutionState,
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
  type ImportedFlowFunctionDefinition,
  type ImportedFlowNode,
} from "@/features/flow/parser";
import type {
  FlowEditorEdge,
  FlowEditorNode,
  FlowFunctionDefinition,
  FunctionCallNodeConfig,
  FlowProgram,
  FlowNodeConfig,
  FlowNodeHandlePositions,
  FlowNodeType,
} from "@/types/flow";
import { flowNodeTypes } from "@/types/flow";
import { FlowCodePanel } from "./FlowCodePanel";
import {
  FlowDialogModal,
  type FlowDialogRequest,
} from "./FlowDialogModal";
import { FlowExecutionHistoryPanel } from "./FlowExecutionHistoryPanel";
import { FlowExecutionPanel } from "./FlowExecutionPanel";
import {
  FlowExportModal,
  type FlowExportOptions,
} from "./FlowExportModal";
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

const initialCodeGenerationResult: FlowCodeGenerationResult = {
  code: "",
  warnings: [],
};

type ImportStatus = "idle" | "success" | "error";
type PendingFlowDialog = FlowDialogRequest & {
  onConfirm: () => void;
};
type AvailableFlowFunctions = NonNullable<
  FlowEditorNode["data"]["availableFunctions"]
>;
type RenderedNodeExecution = NonNullable<
  FlowEditorNode["data"]["execution"]
>;
type ExportedFlowNode = {
  id: string;
  type: FlowNodeType;
  position: FlowEditorNode["position"];
  data: {
    label: string;
    config: FlowNodeConfig;
    handlePositions?: FlowNodeHandlePositions;
  };
  height?: number;
  measured?: FlowEditorNode["measured"];
  width?: number;
};
type ExportedFlowDiagram = {
  nodes: ExportedFlowNode[];
  edges: FlowEditorEdge[];
};
type ExportedFlowFunction = Omit<FlowFunctionDefinition, "nodes" | "edges"> &
  ExportedFlowDiagram;
type FlowDiagramExportFile = {
  schema: "flowcode.diagram";
  version: 1;
  exportedAt: string;
  activeDiagramId: string;
  code: string;
  codeWarnings: string[];
  program: {
    main: ExportedFlowDiagram;
    functions: ExportedFlowFunction[];
  };
};

export function FlowWorkspace() {
  const { language, t } = useI18n();
  const nextNodeId = useRef(initialFlowNodes.length);
  const nextFunctionId = useRef(0);
  const loadedExerciseStarterCode = useRef<string | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const importJsonInputRef = useRef<HTMLInputElement | null>(null);
  const exerciseCatalog = useMemo(() => getExercises(language), [language]);
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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );
  const [dialogRequest, setDialogRequest] =
    useState<PendingFlowDialog | null>(null);
  const [activeDiagramId, setActiveDiagramId] = useState("main");
  const [mainDiagram, setMainDiagram] = useState<FlowProgram["main"]>({
    nodes: initialFlowNodes,
    edges: initialFlowEdges,
  });
  const [functions, setFunctions] = useState<FlowFunctionDefinition[]>([]);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<FlowEditorNode>(initialFlowNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<FlowEditorEdge>(initialFlowEdges);
  const availableFunctions = useMemo<AvailableFlowFunctions>(
    () =>
      functions.map(({ id, name, parameters, parameterDefinitions }) => ({
        id,
        name,
        parameters,
        parameterDefinitions,
      })),
    [functions],
  );
  const currentProgram = useMemo<FlowProgram>(
    () => ({
      main:
        activeDiagramId === "main"
          ? {
              nodes,
              edges,
            }
          : mainDiagram,
      functions: functions.map((flowFunction) =>
        flowFunction.id === activeDiagramId
          ? {
              ...flowFunction,
              nodes,
              edges,
            }
          : flowFunction,
      ),
    }),
    [activeDiagramId, edges, functions, mainDiagram, nodes],
  );
  const analysisNodeSignature = useMemo(
    () => getPositionAgnosticNodeSignature(nodes),
    [nodes],
  );
  const analysisNodes = useMemo(
    () => nodes,
    // Reuse the previous node snapshot when React Flow only changes position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysisNodeSignature],
  );
  const analysisFunctions = useMemo(
    () =>
      activeDiagramId === "main"
        ? functions
        : functions.map((flowFunction) =>
            flowFunction.id === activeDiagramId
              ? {
                  ...flowFunction,
                  nodes: analysisNodes,
                  edges,
                }
              : flowFunction,
          ),
    [activeDiagramId, analysisNodes, edges, functions],
  );
  const selectedExercise = useMemo(
    () =>
      exerciseCatalog.find((exercise) => exercise.id === selectedExerciseId) ??
      null,
    [exerciseCatalog, selectedExerciseId],
  );
  const activeDiagramName =
    activeDiagramId === "main"
      ? t("flow.main")
      : `${t("flow.function")} ${
          functions.find(
            (flowFunction) => flowFunction.id === activeDiagramId,
          )?.name ?? t("flow.unnamed")
        }`;
  const graph = useMemo(
    () => createFlowGraph(analysisNodes, edges),
    [analysisNodes, edges],
  );
  const validationIssues = useMemo(
    () =>
      validateFlowDiagram({
        nodes: analysisNodes,
        edges,
        functions: analysisFunctions,
        currentDiagramId: activeDiagramId,
      }),
    [activeDiagramId, analysisFunctions, analysisNodes, edges],
  );
  const hasLoops = useMemo(() => hasFlowCycles(graph), [graph]);
  const canContinueExecution =
    executionState.status !== "finished" &&
    executionState.status !== "error" &&
    executionState.status !== "waitingInput" &&
    executionState.status !== "waitingFunctionParameters";
  const isAutoExecutionActive = isAutoRunning && canContinueExecution;
  const hasActiveDiagramContent = nodes.length > 0 || edges.length > 0;
  const nodeExecutionById = useMemo(
    () =>
      getRenderedNodeExecutions({
        activeDecision: executionState.activeDecision,
        activeDiagramId,
        currentDiagramId: executionState.currentDiagramId,
        currentNodeId: executionState.currentNodeId,
        history: executionState.history,
      }),
    [
      activeDiagramId,
      executionState.activeDecision,
      executionState.currentDiagramId,
      executionState.currentNodeId,
      executionState.history,
    ],
  );
  const getNodeExecution = useCallback(
    (nodeId: string) => nodeExecutionById.get(nodeId),
    [nodeExecutionById],
  );
  const flowNodeRenderContextValue = useMemo(
    () => ({
      availableFunctions,
      getExecution: getNodeExecution,
    }),
    [availableFunctions, getNodeExecution],
  );
  const renderedEdges = useMemo(() => {
    const visitedEdgeIds = new Set(
      executionState.history.flatMap((item) =>
        item.edgeId ? [item.edgeId] : [],
      ),
    );
    const isCurrentExecutionDiagram =
      executionState.currentDiagramId === activeDiagramId;

    return edges.map((edge) => {
      const isActive =
        isCurrentExecutionDiagram && edge.id === executionState.activeEdgeId;
      const isVisited = isCurrentExecutionDiagram && visitedEdgeIds.has(edge.id);

      const stroke = isActive ? "#ca8a04" : "#059669";
      const localizedLabel = getLocalizedEdgeLabel(edge.sourceHandle, t);

      if (!isActive && !isVisited) {
        return {
          ...edge,
          label: localizedLabel ?? edge.label,
        };
      }

      return {
        ...edge,
        label: localizedLabel ?? edge.label,
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
  }, [
    activeDiagramId,
    edges,
    executionState.activeEdgeId,
    executionState.currentDiagramId,
    executionState.history,
    t,
  ]);

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

  useEffect(() => {
    if (!isAutoExecutionActive) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setExecutionState((currentExecutionState) =>
        stepFlowExecution({
          program: currentProgram,
          activeDiagramId,
          state: currentExecutionState,
        }),
      );
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeDiagramId,
    currentProgram,
    executionState.stepCount,
    isAutoExecutionActive,
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
                    language,
                  ),
                },
              }
            : node,
        ),
      );
    },
    [language, setNodes],
  );

  const handleNodeHandlePositionsChange = useCallback(
    (nodeId: string, handlePositions: FlowNodeHandlePositions) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  handlePositions,
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
          handlePositions: {
            ...getDefaultFlowNodeHandlePositions(node.type),
            ...node.data.handlePositions,
          },
          onLabelChange: handleNodeLabelChange,
          onConfigChange: handleNodeConfigChange,
          onHandlePositionsChange: handleNodeHandlePositionsChange,
        },
      }) as FlowEditorNode,
    [
      handleNodeConfigChange,
      handleNodeHandlePositionsChange,
      handleNodeLabelChange,
    ],
  );

  const createFunctionDefinitionFromImport = useCallback(
    (
      flowFunction: ImportedFlowFunctionDefinition,
    ): FlowFunctionDefinition => ({
      ...flowFunction,
      nodes: flowFunction.nodes.map(createEditorNodeFromImport),
    }),
    [createEditorNodeFromImport],
  );

  const createEditorNodeFromStarter = useCallback(
    (node: ExerciseStarterNode): FlowEditorNode =>
      createEditorNodeFromImport(node as ImportedFlowNode),
    [createEditorNodeFromImport],
  );

  const createFunctionDefinitionFromStarter = useCallback(
    (
      flowFunction: ExerciseStarterFunction,
    ): FlowFunctionDefinition => ({
      ...flowFunction,
      nodes: flowFunction.nodes.map(createEditorNodeFromStarter),
      edges: flowFunction.edges.map(createEditorEdgeFromStarter),
    }),
    [createEditorNodeFromStarter],
  );

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
      setExecutionState(resetFlowExecution("main", t("flow.main")));
      nextNodeId.current = loadedNodeCount;
    },
    [
      createEditorNodeFromStarter,
      createFunctionDefinitionFromStarter,
      setEdges,
      setNodes,
      t,
    ],
  );

  const handleSelectExercise = useCallback(
    (exerciseId: string) => {
      const exercise = exerciseCatalog.find((item) => item.id === exerciseId);

      if (!exercise || exercise.id === selectedExerciseId) {
        return;
      }

      const replacesEditedStarterCode =
        exercise.starterCode !== undefined &&
        importCode.trim().length > 0 &&
        importCode !== exercise.starterCode &&
        importCode !== loadedExerciseStarterCode.current;
      const replacesDiagram =
        exercise.starterDiagram !== undefined &&
        hasDiagramContent(currentProgram);

      const applyExerciseSelection = () => {
        setSelectedExerciseId(exercise.id);
        setBlockedConnectionMessage(null);
        setIsAutoRunning(false);
        setCodeGenerationResult(initialCodeGenerationResult);

        if (exercise.starterCode !== undefined) {
          setImportCode(exercise.starterCode);
          setImportStatus("success");
          setImportMessage(t("flow.importLoaded"));
          setImportWarnings([]);
          loadedExerciseStarterCode.current = exercise.starterCode;
        } else {
          loadedExerciseStarterCode.current = null;
        }

        if (exercise.starterDiagram) {
          loadStarterDiagram(exercise.starterDiagram);
        }
      };

      if (replacesEditedStarterCode || replacesDiagram) {
        setDialogRequest({
          title: t("flow.replaceDialogTitle"),
          message: t("flow.replaceDialogMessage"),
          confirmLabel: t("flow.replace"),
          tone: "warning",
          onConfirm: applyExerciseSelection,
        });
        return;
      }

      applyExerciseSelection();
    },
    [
      currentProgram,
      exerciseCatalog,
      importCode,
      loadStarterDiagram,
      selectedExerciseId,
      t,
    ],
  );

  const handleAddNode = useCallback(
    (type: FlowNodeType) => {
      setBlockedConnectionMessage(null);
      setIsAutoRunning(false);
      setExecutionState(resetFlowExecution(activeDiagramId, activeDiagramName));
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
      setNodes,
    ],
  );

  const handleStepExecution = useCallback(() => {
    setIsAutoRunning(false);
    setExecutionState((currentExecutionState) =>
      stepFlowExecution({
        program: currentProgram,
        activeDiagramId,
        state: currentExecutionState,
      }),
    );
  }, [activeDiagramId, currentProgram]);

  const handleRunExecution = useCallback(() => {
    setIsAutoRunning(true);
  }, []);

  const handlePauseExecution = useCallback(() => {
    setIsAutoRunning(false);
  }, []);

  const handleResetExecution = useCallback(() => {
    setIsAutoRunning(false);
    setExecutionState(resetFlowExecution(activeDiagramId, activeDiagramName));
  }, [activeDiagramId, activeDiagramName]);

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
      setExecutionState(resetFlowExecution(activeDiagramId, activeDiagramName));
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
    setEdges,
    setNodes,
    t,
  ]);

  const handleGenerateCode = useCallback(() => {
    setCodeGenerationResult(
      generateJavaScriptFromFlow({
        nodes: currentProgram.main.nodes,
        edges: currentProgram.main.edges,
        functions: currentProgram.functions,
      }),
    );
  }, [currentProgram]);

  const handleImportCode = useCallback(() => {
    const importResult = importJavaScriptToFlow(importCode);

    if (!importResult.ok) {
      setImportStatus("error");
      setImportMessage(importResult.message);
      setImportWarnings([]);
      return;
    }

    const importedNodes = importResult.nodes.map(createEditorNodeFromImport);
    const importedFunctions = importResult.functions.map(
      createFunctionDefinitionFromImport,
    );
    const nextMainDiagram = {
      nodes: importedNodes,
      edges: importResult.edges,
    };
    const importedNodeCount =
      importResult.nodes.length +
      importResult.functions.reduce(
        (count, flowFunction) => count + flowFunction.nodes.length,
        0,
      );

    setBlockedConnectionMessage(null);
    setIsAutoRunning(false);
    setExecutionState(resetFlowExecution("main", t("flow.main")));
    setCodeGenerationResult(initialCodeGenerationResult);
    setImportStatus("success");
    setImportMessage(
      importedFunctions.length > 0
        ? t("flow.importGeneratedWithFunctions")
        : t("flow.importGenerated"),
    );
    setImportWarnings(importResult.warnings);
    nextNodeId.current = importedNodeCount;
    setActiveDiagramId("main");
    setMainDiagram(nextMainDiagram);
    setFunctions(importedFunctions);
    setNodes(nextMainDiagram.nodes);
    setEdges(nextMainDiagram.edges);
  }, [
    createFunctionDefinitionFromImport,
    createEditorNodeFromImport,
    importCode,
    setEdges,
    setNodes,
    t,
  ]);

  const handleOpenExportModal = useCallback(() => {
    setExportError(null);
    setIsExportModalOpen(true);
  }, []);

  const handleCloseExportModal = useCallback(() => {
    if (isExporting) {
      return;
    }

    setExportError(null);
    setIsExportModalOpen(false);
  }, [isExporting]);

  const handleExportDiagram = useCallback(
    async (options: FlowExportOptions) => {
      setIsExporting(true);
      setExportError(null);

      try {
        const generatedCode = generateJavaScriptFromFlow({
          nodes: currentProgram.main.nodes,
          edges: currentProgram.main.edges,
          functions: currentProgram.functions,
        });
        const baseFileName = createExportBaseFileName();

        if (options.includeImage) {
          await exportDiagramImage({
            editorShell: editorShellRef.current,
            fileName: `${baseFileName}.${options.imageFormat}`,
            format: options.imageFormat,
            nodes,
            noDiagramMessage: t("flow.exportNoDiagram"),
          });
        }

        if (options.includeJavaScript) {
          downloadTextFile({
            content: generatedCode.code,
            fileName: `${baseFileName}.js`,
            mimeType: "text/javascript;charset=utf-8",
          });
        }

        if (options.includeJson) {
          downloadTextFile({
            content: JSON.stringify(
              createFlowDiagramExportFile({
                activeDiagramId,
                codeGenerationResult: generatedCode,
                program: currentProgram,
              }),
              null,
              2,
            ),
            fileName: `${baseFileName}.json`,
            mimeType: "application/json;charset=utf-8",
          });
        }

        setCodeGenerationResult(generatedCode);
        setIsExportModalOpen(false);
      } catch (error) {
        setExportError(
          error instanceof Error
            ? error.message
            : t("flow.exportImageError"),
        );
      } finally {
        setIsExporting(false);
      }
    },
    [activeDiagramId, currentProgram, nodes, t],
  );

  const handleImportJsonButtonClick = useCallback(() => {
    importJsonInputRef.current?.click();
  }, []);

  const handleImportJsonFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      try {
        const importedDiagram = parseFlowDiagramExportFile(
          await file.text(),
          createEditorNodeFromImport,
          t("flow.importJsonInvalid"),
        );

        if (!importedDiagram.ok) {
          setImportStatus("error");
          setImportMessage(importedDiagram.message);
          setImportWarnings([]);
          return;
        }

        const applyImport = () => {
          const nextProgram = importedDiagram.program;
          const nextActiveDiagramId = getImportActiveDiagramId(
            importedDiagram.activeDiagramId,
            nextProgram,
          );
          const nextActiveDiagram = getDiagramById(
            nextProgram,
            nextActiveDiagramId,
          );
          const nextActiveDiagramName = getDiagramNameById(
            nextProgram,
            nextActiveDiagramId,
            t,
          );
          const nextCode =
            importedDiagram.code.trim().length > 0
              ? importedDiagram.code
              : generateJavaScriptFromFlow({
                  nodes: nextProgram.main.nodes,
                  edges: nextProgram.main.edges,
                  functions: nextProgram.functions,
                }).code;

          setBlockedConnectionMessage(null);
          setIsAutoRunning(false);
          setSelectedExerciseId(null);
          setActiveDiagramId(nextActiveDiagramId);
          setMainDiagram(nextProgram.main);
          setFunctions(nextProgram.functions);
          setNodes(nextActiveDiagram.nodes);
          setEdges(nextActiveDiagram.edges);
          setImportCode(nextCode);
          setImportStatus("success");
          setImportMessage(t("flow.importJsonSuccess"));
          setImportWarnings([]);
          setCodeGenerationResult({
            code: nextCode,
            warnings: importedDiagram.codeWarnings,
          });
          setExecutionState(
            resetFlowExecution(nextActiveDiagramId, nextActiveDiagramName),
          );
          loadedExerciseStarterCode.current = null;
          nextNodeId.current = getNextNodeCounter(nextProgram);
          nextFunctionId.current = getNextFunctionCounter(nextProgram);
        };

        if (hasDiagramContent(currentProgram)) {
          setDialogRequest({
            title: t("flow.replaceDialogTitle"),
            message: t("flow.replaceDialogMessage"),
            confirmLabel: t("flow.replace"),
            tone: "warning",
            onConfirm: applyImport,
          });
          return;
        }

        applyImport();
      } catch {
        setImportStatus("error");
        setImportMessage(t("flow.importJsonReadError"));
        setImportWarnings([]);
      }
    },
    [
      createEditorNodeFromImport,
      currentProgram,
      setEdges,
      setNodes,
      t,
    ],
  );

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
      setExecutionState(resetFlowExecution(activeDiagramId, activeDiagramName));

      setEdges((currentEdges) =>
        addEdge(createFlowEditorEdge(connection), currentEdges),
      );
    },
    [activeDiagramId, activeDiagramName, analysisNodes, edges, setEdges],
  );

  const isValidConnection = useCallback<IsValidConnection<FlowEditorEdge>>(
    (connection) =>
      validateFlowConnection({
        nodes: analysisNodes,
        edges,
        connection,
      }).length === 0,
    [analysisNodes, edges],
  );

  const handleInputConfirm = useCallback(
    (value: Parameters<typeof resumeFlowExecutionWithInput>[0]["value"]) => {
      setExecutionState((currentExecutionState) =>
        resumeFlowExecutionWithInput({
          state: currentExecutionState,
          value,
        }),
      );
    },
    [],
  );

  const handleFunctionParameterConfirm = useCallback(
    (
      values: Parameters<
        typeof resumeFlowExecutionWithFunctionParameters
      >[0]["values"],
    ) => {
      setExecutionState((currentExecutionState) =>
        resumeFlowExecutionWithFunctionParameters({
          state: currentExecutionState,
          values,
        }),
      );
    },
    [],
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
      setExecutionState(
        resetFlowExecution(
          diagramId,
          diagramId === "main"
            ? t("flow.main")
            : `${t("flow.function")} ${
                currentProgram.functions.find(
                  (flowFunction) => flowFunction.id === diagramId,
                )?.name ?? t("flow.unnamed")
              }`,
        ),
      );
    },
    [currentProgram, setEdges, setNodes, t],
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
    setExecutionState(
      resetFlowExecution(
        flowFunction.id,
        `${t("flow.function")} ${flowFunction.name}`,
      ),
    );
  }, [currentProgram, setEdges, setNodes, t]);

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
    [activeDiagramId, edges, nodes],
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
        setExecutionState(resetFlowExecution("main", t("flow.main")));
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
      setExecutionState(
        resetFlowExecution(
          activeFunction.id,
          `${t("flow.function")} ${activeFunction.name}`,
        ),
      );
    },
    [activeDiagramId, currentProgram, setEdges, setNodes, t],
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
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
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

function getPositionAgnosticNodeSignature(nodes: FlowEditorNode[]) {
  return JSON.stringify(
    nodes.map((node) => [
      node.id,
      node.type,
      node.data.label,
      node.data.config,
      node.data.handlePositions ?? null,
    ]),
  );
}

function getRenderedNodeExecutions({
  activeDecision,
  activeDiagramId,
  currentNodeId,
  currentDiagramId,
  history,
}: {
  activeDecision: FlowExecutionState["activeDecision"];
  activeDiagramId: string;
  currentNodeId: FlowExecutionState["currentNodeId"];
  currentDiagramId: string;
  history: FlowExecutionState["history"];
}) {
  const executionsByNodeId = new Map<string, RenderedNodeExecution>();

  if (currentDiagramId !== activeDiagramId) {
    return executionsByNodeId;
  }

  for (const item of history) {
    executionsByNodeId.set(item.nodeId, {
      isCurrent: false,
      isVisited: true,
      activeBranch: null,
    });
  }

  if (currentNodeId) {
    const currentExecution = executionsByNodeId.get(currentNodeId);

    executionsByNodeId.set(currentNodeId, {
      isCurrent: true,
      isVisited: currentExecution?.isVisited ?? false,
      activeBranch: currentExecution?.activeBranch ?? null,
    });
  }

  if (activeDecision) {
    const decisionExecution = executionsByNodeId.get(activeDecision.nodeId);

    executionsByNodeId.set(activeDecision.nodeId, {
      isCurrent: decisionExecution?.isCurrent ?? false,
      isVisited: decisionExecution?.isVisited ?? false,
      activeBranch: activeDecision.branch,
    });
  }

  return executionsByNodeId;
}

function createFlowDiagramExportFile({
  activeDiagramId,
  codeGenerationResult,
  program,
}: {
  activeDiagramId: string;
  codeGenerationResult: FlowCodeGenerationResult;
  program: FlowProgram;
}): FlowDiagramExportFile {
  return {
    schema: "flowcode.diagram",
    version: 1,
    exportedAt: new Date().toISOString(),
    activeDiagramId,
    code: codeGenerationResult.code,
    codeWarnings: codeGenerationResult.warnings,
    program: {
      main: serializeFlowDiagram(program.main),
      functions: program.functions.map((flowFunction) => ({
        id: flowFunction.id,
        name: flowFunction.name,
        parameters: flowFunction.parameters,
        parameterDefinitions: flowFunction.parameterDefinitions,
        ...serializeFlowDiagram(flowFunction),
      })),
    },
  };
}

function serializeFlowDiagram(
  diagram: FlowProgram["main"],
): ExportedFlowDiagram {
  return {
    nodes: diagram.nodes.map(serializeFlowNode),
    edges: cloneJson(diagram.edges),
  };
}

function serializeFlowNode(node: FlowEditorNode): ExportedFlowNode {
  return {
    id: node.id,
    type: node.type,
    position: {
      x: node.position.x,
      y: node.position.y,
    },
    width: node.width,
    height: node.height,
    measured: node.measured,
    data: {
      label: node.data.label,
      config: cloneJson(node.data.config),
      handlePositions: node.data.handlePositions,
    },
  };
}

async function exportDiagramImage({
  editorShell,
  fileName,
  format,
  nodes,
  noDiagramMessage,
}: {
  editorShell: HTMLDivElement | null;
  fileName: string;
  format: FlowExportOptions["imageFormat"];
  nodes: FlowEditorNode[];
  noDiagramMessage: string;
}) {
  if (nodes.length === 0) {
    throw new Error(noDiagramMessage);
  }

  const viewport = editorShell?.querySelector<HTMLElement>(
    ".react-flow__viewport",
  );

  if (!viewport) {
    throw new Error(noDiagramMessage);
  }

  const bounds = getNodesBounds(nodes);
  const imageWidth = clampNumber(Math.ceil(bounds.width + 180), 900, 5000);
  const imageHeight = clampNumber(Math.ceil(bounds.height + 180), 640, 5000);
  const exportViewport = getViewportForBounds(
    bounds,
    imageWidth,
    imageHeight,
    0.1,
    1.6,
    0.14,
  );
  const imageOptions = {
    backgroundColor: "#f5f5f5",
    cacheBust: true,
    height: imageHeight,
    pixelRatio: 2,
    skipAutoScale: true,
    style: {
      height: `${imageHeight}px`,
      transform: `translate(${exportViewport.x}px, ${exportViewport.y}px) scale(${exportViewport.zoom})`,
      width: `${imageWidth}px`,
    },
    width: imageWidth,
  };
  const dataUrl =
    format === "svg"
      ? await toSvg(viewport, imageOptions)
      : format === "jpg"
        ? await toJpeg(viewport, {
            ...imageOptions,
            quality: 0.95,
          })
        : await toPng(viewport, imageOptions);

  downloadDataUrl({
    dataUrl,
    fileName,
  });
}

function parseFlowDiagramExportFile(
  text: string,
  createEditorNodeFromImport: (node: ImportedFlowNode) => FlowEditorNode,
  invalidMessage: string,
):
  | {
      ok: true;
      activeDiagramId: string;
      code: string;
      codeWarnings: string[];
      program: FlowProgram;
    }
  | {
      ok: false;
      message: string;
    } {
  const parsedValue = JSON.parse(text) as unknown;
  const root = isRecord(parsedValue) ? parsedValue : null;
  const programValue = root?.program;

  if (
    root?.schema !== "flowcode.diagram" ||
    root.version !== 1 ||
    !isRecord(programValue)
  ) {
    return {
      ok: false,
      message: invalidMessage,
    };
  }

  const main = parseExportedDiagram(
    programValue.main,
    createEditorNodeFromImport,
  );
  const functionValues = Array.isArray(programValue.functions)
    ? programValue.functions
    : [];
  const functions = functionValues
    .map((flowFunction) =>
      parseExportedFunction(flowFunction, createEditorNodeFromImport),
    )
    .filter((flowFunction): flowFunction is FlowFunctionDefinition =>
      flowFunction !== null,
    );

  if (!main || functions.length !== functionValues.length) {
    return {
      ok: false,
      message: invalidMessage,
    };
  }

  return {
    ok: true,
    activeDiagramId: readString(root.activeDiagramId, "main"),
    code: readString(root.code, ""),
    codeWarnings: readStringArray(root.codeWarnings),
    program: {
      main,
      functions,
    },
  };
}

function parseExportedFunction(
  value: unknown,
  createEditorNodeFromImport: (node: ImportedFlowNode) => FlowEditorNode,
): FlowFunctionDefinition | null {
  if (!isRecord(value)) {
    return null;
  }

  const diagram = parseExportedDiagram(value, createEditorNodeFromImport);

  if (!diagram) {
    return null;
  }

  return {
    id: readString(value.id, ""),
    name: readString(value.name, ""),
    parameters: readStringArray(value.parameters),
    parameterDefinitions: readParameterDefinitions(value.parameterDefinitions),
    nodes: diagram.nodes,
    edges: diagram.edges,
  };
}

function parseExportedDiagram(
  value: unknown,
  createEditorNodeFromImport: (node: ImportedFlowNode) => FlowEditorNode,
): FlowProgram["main"] | null {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return null;
  }

  const importedNodes = value.nodes.map(createImportedNodeFromExport);
  const importedEdges = value.edges.map(createEditorEdgeFromExport);

  if (
    importedNodes.some((node) => node === null) ||
    importedEdges.some((edge) => edge === null)
  ) {
    return null;
  }

  return {
    nodes: importedNodes.map((node) =>
      createEditorNodeFromImport(node as ImportedFlowNode),
    ),
    edges: importedEdges as FlowEditorEdge[],
  };
}

function createImportedNodeFromExport(value: unknown): ImportedFlowNode | null {
  if (!isRecord(value) || !isFlowNodeType(value.type)) {
    return null;
  }

  const data = isRecord(value.data) ? value.data : null;
  const id = readString(value.id, "");
  const position = readPosition(value.position);

  if (!data || !id || !position) {
    return null;
  }

  return {
    id,
    type: value.type,
    position,
    width: readOptionalNumber(value.width),
    height: readOptionalNumber(value.height),
    measured: readMeasured(value.measured),
    data: {
      label: readString(data.label, value.type),
      config: isRecord(data.config) ? (cloneJson(data.config) as FlowNodeConfig) : {},
      handlePositions: readHandlePositions(data.handlePositions),
    },
  } as ImportedFlowNode;
}

function createEditorEdgeFromExport(value: unknown): FlowEditorEdge | null {
  if (!isRecord(value)) {
    return null;
  }

  const source = readString(value.source, "");
  const target = readString(value.target, "");

  if (!source || !target) {
    return null;
  }

  const connection: Connection = {
    source,
    target,
    sourceHandle: readNullableString(value.sourceHandle),
    targetHandle: readNullableString(value.targetHandle) ?? "in",
  };
  const serializedEdge = cloneJson(value) as Partial<FlowEditorEdge>;

  return {
    ...createFlowEditorEdge(connection),
    ...serializedEdge,
    id: readString(value.id, createFlowEditorEdge(connection).id),
    source,
    sourceHandle: connection.sourceHandle,
    target,
    targetHandle: connection.targetHandle,
    type: "flow",
  };
}

function getImportActiveDiagramId(
  importedActiveDiagramId: string,
  program: FlowProgram,
) {
  if (
    importedActiveDiagramId === "main" ||
    program.functions.some(
      (flowFunction) => flowFunction.id === importedActiveDiagramId,
    )
  ) {
    return importedActiveDiagramId;
  }

  return "main";
}

function getDiagramById(program: FlowProgram, diagramId: string) {
  if (diagramId === "main") {
    return program.main;
  }

  return (
    program.functions.find((flowFunction) => flowFunction.id === diagramId) ??
    program.main
  );
}

function getDiagramNameById(
  program: FlowProgram,
  diagramId: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (diagramId === "main") {
    return t("flow.main");
  }

  const flowFunction = program.functions.find(
    (item) => item.id === diagramId,
  );

  return `${t("flow.function")} ${flowFunction?.name ?? t("flow.unnamed")}`;
}

function getNextNodeCounter(program: FlowProgram) {
  const nodeIds = [
    ...program.main.nodes.map((node) => node.id),
    ...program.functions.flatMap((flowFunction) =>
      flowFunction.nodes.map((node) => node.id),
    ),
  ];

  return Math.max(nodeIds.length, getMaxNumericSuffix(nodeIds));
}

function getNextFunctionCounter(program: FlowProgram) {
  return getMaxNumericSuffix(
    program.functions.map((flowFunction) => flowFunction.id),
  );
}

function getMaxNumericSuffix(values: string[]) {
  return values.reduce((maxValue, value) => {
    const match = /-(\d+)$/.exec(value);

    return match ? Math.max(maxValue, Number(match[1])) : maxValue;
  }, 0);
}

function readHandlePositions(value: unknown): FlowNodeHandlePositions | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const handlePositions: FlowNodeHandlePositions = {};

  for (const handleId of ["in", "out", "yes", "no"] as const) {
    if (isFlowHandlePosition(value[handleId])) {
      handlePositions[handleId] = value[handleId];
    }
  }

  return Object.keys(handlePositions).length > 0
    ? handlePositions
    : undefined;
}

function readParameterDefinitions(
  value: unknown,
): FlowFunctionDefinition["parameterDefinitions"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter(isRecord)
    .map((parameter) => ({
      name: readString(parameter.name, ""),
      source: readString(parameter.source, ""),
      defaultValue:
        typeof parameter.defaultValue === "string"
          ? parameter.defaultValue
          : undefined,
      rest: typeof parameter.rest === "boolean" ? parameter.rest : undefined,
    }))
    .filter((parameter) => parameter.name || parameter.source);
}

function readPosition(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const x = readOptionalNumber(value.x);
  const y = readOptionalNumber(value.y);

  return x === undefined || y === undefined
    ? null
    : {
        x,
        y,
      };
}

function readMeasured(value: unknown): FlowEditorNode["measured"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const width = readOptionalNumber(value.width);
  const height = readOptionalNumber(value.height);

  if (width === undefined || height === undefined) {
    return undefined;
  }

  return {
    width,
    height,
  };
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFlowNodeType(value: unknown): value is FlowNodeType {
  return (
    typeof value === "string" &&
    flowNodeTypes.includes(value as FlowNodeType)
  );
}

function isFlowHandlePosition(value: unknown) {
  return (
    value === "top" ||
    value === "right" ||
    value === "bottom" ||
    value === "left"
  );
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createExportBaseFileName() {
  return `flowcode-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19)}`;
}

function downloadTextFile({
  content,
  fileName,
  mimeType,
}: {
  content: string;
  fileName: string;
  mimeType: string;
}) {
  const blob = new Blob([content], {
    type: mimeType,
  });
  const objectUrl = URL.createObjectURL(blob);

  downloadDataUrl({
    dataUrl: objectUrl,
    fileName,
  });
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function downloadDataUrl({
  dataUrl,
  fileName,
}: {
  dataUrl: string;
  fileName: string;
}) {
  const link = document.createElement("a");

  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createEditorEdgeFromStarter(
  edge: ExerciseStarterEdge,
): FlowEditorEdge {
  const connection: Connection = {
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? "in",
  };
  const editorEdge = createFlowEditorEdge(connection);

  return edge.id
    ? {
        ...editorEdge,
        id: edge.id,
      }
    : editorEdge;
}

function getLocalizedEdgeLabel(
  sourceHandle: FlowEditorEdge["sourceHandle"],
  t: ReturnType<typeof useI18n>["t"],
) {
  if (sourceHandle === "yes") {
    return t("flow.yes");
  }

  if (sourceHandle === "no") {
    return t("flow.no");
  }

  return undefined;
}

function hasDiagramContent(program: FlowProgram) {
  return (
    program.main.nodes.length > 0 ||
    program.main.edges.length > 0 ||
    program.functions.length > 0
  );
}

function clearFunctionReferences(
  nodes: FlowEditorNode[],
  functionId: string,
): FlowEditorNode[] {
  return nodes.map((node): FlowEditorNode => {
    const config = node.data.config;

    if (
      !isFunctionCallConfig(config) ||
      config.functionId !== functionId
    ) {
      return node;
    }

    return {
      ...node,
      data: {
        ...node.data,
        config: {
          ...config,
          functionId: "",
        },
      },
    };
  });
}

function isFunctionCallConfig(
  config: FlowNodeConfig,
): config is FunctionCallNodeConfig {
  return "functionId" in config && "args" in config;
}
