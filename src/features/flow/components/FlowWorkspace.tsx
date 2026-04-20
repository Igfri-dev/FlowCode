"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addEdge,
  type Connection,
  useEdgesState,
  useNodesState,
  type IsValidConnection,
  type OnConnect,
} from "@xyflow/react";
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
import { FlowCodePanel } from "./FlowCodePanel";
import {
  FlowDialogModal,
  type FlowDialogRequest,
} from "./FlowDialogModal";
import { FlowExecutionHistoryPanel } from "./FlowExecutionHistoryPanel";
import { FlowExecutionPanel } from "./FlowExecutionPanel";
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

export function FlowWorkspace() {
  const { language, t } = useI18n();
  const nextNodeId = useRef(initialFlowNodes.length);
  const nextFunctionId = useRef(0);
  const loadedExerciseStarterCode = useRef<string | null>(null);
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
