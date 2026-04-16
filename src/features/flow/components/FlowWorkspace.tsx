"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { FlowExecutionHistoryPanel } from "./FlowExecutionHistoryPanel";
import { FlowExecutionPanel } from "./FlowExecutionPanel";
import { FlowFunctionPanel } from "./FlowFunctionPanel";
import { FlowImportPanel } from "./FlowImportPanel";
import { FlowInputModal } from "./FlowInputModal";
import { FlowOutputPanel } from "./FlowOutputPanel";
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
  const nextFunctionId = useRef(0);
  const loadedExerciseStarterCode = useRef<string | null>(null);
  const exerciseCatalog = useMemo(() => getExercises(), []);
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
  const selectedExercise = useMemo(
    () =>
      exerciseCatalog.find((exercise) => exercise.id === selectedExerciseId) ??
      null,
    [exerciseCatalog, selectedExerciseId],
  );
  const activeDiagramName =
    activeDiagramId === "main"
      ? "Principal"
      : `Funcion ${
          currentProgram.functions.find(
            (flowFunction) => flowFunction.id === activeDiagramId,
          )?.name ?? "sin nombre"
        }`;
  const graph = useMemo(() => createFlowGraph(nodes, edges), [edges, nodes]);
  const validationIssues = useMemo(
    () =>
      validateFlowDiagram({
        nodes,
        edges,
        functions: currentProgram.functions,
        currentDiagramId: activeDiagramId,
      }),
    [activeDiagramId, currentProgram.functions, edges, nodes],
  );
  const hasLoops = useMemo(() => hasFlowCycles(graph), [graph]);
  const canContinueExecution =
    executionState.status !== "finished" &&
    executionState.status !== "error" &&
    executionState.status !== "waitingInput";
  const isAutoExecutionActive = isAutoRunning && canContinueExecution;
  const hasActiveDiagramContent = nodes.length > 0 || edges.length > 0;
  const renderedNodes = useMemo(() => {
    const visitedNodeIds = new Set(
      executionState.history.map((item) => item.nodeId),
    );
    const availableFunctions = currentProgram.functions.map(
      ({ id, name, parameters }) => ({
        id,
        name,
        parameters,
      }),
    );
    const isCurrentExecutionDiagram =
      executionState.currentDiagramId === activeDiagramId;

    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        availableFunctions,
        execution: {
          isCurrent:
            isCurrentExecutionDiagram &&
            node.id === executionState.currentNodeId,
          isVisited: isCurrentExecutionDiagram && visitedNodeIds.has(node.id),
          activeBranch:
            isCurrentExecutionDiagram &&
            executionState.activeDecision?.nodeId === node.id
              ? executionState.activeDecision.branch
              : null,
        },
      },
    }));
  }, [
    activeDiagramId,
    currentProgram.functions,
    executionState.activeDecision,
    executionState.currentDiagramId,
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
    const isCurrentExecutionDiagram =
      executionState.currentDiagramId === activeDiagramId;

    return edges.map((edge) => {
      const isActive =
        isCurrentExecutionDiagram && edge.id === executionState.activeEdgeId;
      const isVisited = isCurrentExecutionDiagram && visitedEdgeIds.has(edge.id);

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
  }, [
    activeDiagramId,
    edges,
    executionState.activeEdgeId,
    executionState.currentDiagramId,
    executionState.history,
  ]);

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
                  ),
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
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
      setExecutionState(resetFlowExecution("main", "Principal"));
      nextNodeId.current = loadedNodeCount;
    },
    [
      createEditorNodeFromStarter,
      createFunctionDefinitionFromStarter,
      setEdges,
      setNodes,
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

      if (
        (replacesEditedStarterCode || replacesDiagram) &&
        !window.confirm(
          "Seleccionar este ejercicio reemplazara contenido actual del espacio de trabajo. Continuar?",
        )
      ) {
        return;
      }

      setSelectedExerciseId(exercise.id);
      setBlockedConnectionMessage(null);
      setIsAutoRunning(false);
      setCodeGenerationResult(initialCodeGenerationResult);

      if (exercise.starterCode !== undefined) {
        setImportCode(exercise.starterCode);
        setImportStatus("success");
        setImportMessage(
          "Codigo inicial del ejercicio cargado en el importador.",
        );
        setImportWarnings([]);
        loadedExerciseStarterCode.current = exercise.starterCode;
      } else {
        loadedExerciseStarterCode.current = null;
      }

      if (exercise.starterDiagram) {
        loadStarterDiagram(exercise.starterDiagram);
      }
    },
    [
      currentProgram,
      exerciseCatalog,
      importCode,
      loadStarterDiagram,
      selectedExerciseId,
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

    if (
      !window.confirm(
        `Limpiar el diagrama "${activeDiagramName}"? Se eliminaran todos los bloques y conexiones.`,
      )
    ) {
      return;
    }

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
  }, [
    activeDiagramId,
    activeDiagramName,
    currentProgram.functions,
    currentProgram.main,
    hasActiveDiagramContent,
    setEdges,
    setNodes,
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
    setExecutionState(resetFlowExecution("main", "Principal"));
    setCodeGenerationResult(initialCodeGenerationResult);
    setImportStatus("success");
    setImportMessage(
      importedFunctions.length > 0
        ? "Diagrama y funciones generados desde el codigo JavaScript."
        : "Diagrama generado desde el codigo JavaScript.",
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
  ]);

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
      setExecutionState(resetFlowExecution(activeDiagramId, activeDiagramName));

      setEdges((currentEdges) =>
        addEdge(createFlowEditorEdge(connection), currentEdges),
      );
    },
    [activeDiagramId, activeDiagramName, edges, nodes, setEdges],
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
            ? "Principal"
            : `Funcion ${
                currentProgram.functions.find(
                  (flowFunction) => flowFunction.id === diagramId,
                )?.name ?? "sin nombre"
              }`,
        ),
      );
    },
    [currentProgram, setEdges, setNodes],
  );

  const handleCreateFunction = useCallback(() => {
    const functionIndex = currentProgram.functions.length + 1;
    nextFunctionId.current += 1;

    const flowFunction: FlowFunctionDefinition = {
      id: `function-${nextFunctionId.current}`,
      name: `funcion${functionIndex}`,
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
      resetFlowExecution(flowFunction.id, `Funcion ${flowFunction.name}`),
    );
  }, [currentProgram, setEdges, setNodes]);

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
        setExecutionState(resetFlowExecution("main", "Principal"));
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
        resetFlowExecution(activeFunction.id, `Funcion ${activeFunction.name}`),
      );
    },
    [activeDiagramId, currentProgram, setEdges, setNodes],
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
          functions={currentProgram.functions}
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
                Diagrama: {activeDiagramName}
              </p>
              <p className="text-xs text-neutral-500">
                Agrega bloques desde la barra lateral
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={handleClearActiveDiagram}
                disabled={!hasActiveDiagramContent}
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition-all hover:-translate-y-px hover:border-red-300 hover:bg-red-50 hover:text-red-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
              >
                Limpiar
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
                {nodes.length} bloques
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-neutral-100">
            <FlowEditor
              nodes={renderedNodes}
              edges={renderedEdges}
              nodeTypes={flowNodeComponents}
              edgeTypes={flowEdgeComponents}
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

      <aside className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2 xl:col-span-1 xl:flex xl:flex-col">
        <FlowVariablesPanel variables={executionState.variables} />
        <FlowOutputPanel outputs={executionState.outputs} />
        <FlowExecutionHistoryPanel history={executionState.history} />
      </aside>
      <FlowInputModal
        pendingInput={executionState.pendingInput}
        onConfirm={handleInputConfirm}
      />
    </section>
  );
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
