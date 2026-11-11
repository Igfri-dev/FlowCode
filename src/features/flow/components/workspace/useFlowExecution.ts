import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import {
  resetFlowExecution,
  resumeFlowExecutionWithFunctionParameters,
  resumeFlowExecutionWithInput,
  stepFlowExecution,
  type FlowExecutionState,
} from "@/features/flow/execution";
import {
  canContinueFlowExecution,
  runFlowExecutionBatch,
} from "@/features/flow/execution-batch";
import type { useI18n } from "@/features/i18n/I18nProvider";
import type { FlowEditorEdge, FlowEditorNode, FlowProgram } from "@/types/flow";

type AvailableFlowFunctions = NonNullable<
  FlowEditorNode["data"]["availableFunctions"]
>;
type RenderedNodeExecution = NonNullable<FlowEditorNode["data"]["execution"]>;

function createEditorExecution(
  diagramId = "main",
  name = "Principal",
): FlowExecutionState {
  return {
    ...resetFlowExecution(diagramId, name),
    historyLimit: 200,
    outputLimit: 1000,
  };
}

export function useFlowExecution({
  activeDiagramId,
  activeDiagramName,
  availableFunctions,
  currentProgram,
  edges,
  t,
}: {
  activeDiagramId: string;
  activeDiagramName: string;
  availableFunctions: AvailableFlowFunctions;
  currentProgram: FlowProgram;
  edges: FlowEditorEdge[];
  t: ReturnType<typeof useI18n>["t"];
}) {
  const [executionState, commitExecutionState] = useState(
    createEditorExecution,
  );
  const executionRef = useRef(executionState);
  const setExecutionState = useCallback(
    (update: SetStateAction<FlowExecutionState>) => {
      const next =
        typeof update === "function" ? update(executionRef.current) : update;
      executionRef.current = next;
      commitExecutionState(next);
    },
    [],
  );
  const [isAutoRunning, commitAutoRunning] = useState(false);
  const runningRef = useRef(false);
  const setIsAutoRunning = useCallback((running: boolean) => {
    runningRef.current = running;
    commitAutoRunning(running);
  }, []);
  const [executionMode, setExecutionMode] = useState<"animated" | "instant">(
    "animated",
  );
  const canContinueExecution = canContinueFlowExecution(executionState);
  const isAutoExecutionActive = isAutoRunning && canContinueExecution;
  const nodeExecutionById = useMemo(
    () =>
      getRenderedNodeExecutions({
        activeDecision: executionState.activeDecision,
        activeDiagramId,
        currentDiagramId: executionState.currentDiagramId,
        currentNodeId: executionState.currentNodeId,
        visitedNodeIds: executionState.visitedNodeIds[activeDiagramId] ?? [],
      }),
    [
      activeDiagramId,
      executionState.activeDecision,
      executionState.currentDiagramId,
      executionState.currentNodeId,
      executionState.visitedNodeIds,
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
      executionState.visitedEdgeIds[activeDiagramId] ?? [],
    );
    const isCurrentExecutionDiagram =
      executionState.currentDiagramId === activeDiagramId;

    return edges.map((edge) => {
      const isActive =
        isCurrentExecutionDiagram && edge.id === executionState.activeEdgeId;
      const isVisited = visitedEdgeIds.has(edge.id);

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
    executionState.visitedEdgeIds,
    t,
  ]);

  useEffect(() => {
    if (!isAutoExecutionActive) {
      return;
    }

    let cancelled = false;
    let timeoutId: number;
    const tick = () => {
      if (cancelled || !runningRef.current) return;
      const input = {
        program: currentProgram,
        activeDiagramId,
        state: executionRef.current,
      };
      const next =
        executionMode === "instant"
          ? runFlowExecutionBatch(input)
          : stepFlowExecution(input);
      setExecutionState(next);
      if (!cancelled && runningRef.current && canContinueFlowExecution(next)) {
        timeoutId = window.setTimeout(
          tick,
          executionMode === "instant" ? 0 : 500,
        );
      }
    };
    timeoutId = window.setTimeout(tick, executionMode === "instant" ? 0 : 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    activeDiagramId,
    currentProgram,
    executionMode,
    isAutoExecutionActive,
    setExecutionState,
  ]);

  const resetExecutionForDiagram = useCallback(
    (diagramId: string, name: string) => {
      setIsAutoRunning(false);
      setExecutionState(createEditorExecution(diagramId, name));
    },
    [setExecutionState, setIsAutoRunning],
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
  }, [activeDiagramId, currentProgram, setExecutionState, setIsAutoRunning]);

  const handleRunExecution = useCallback(() => {
    setExecutionMode("animated");
    setIsAutoRunning(true);
  }, [setIsAutoRunning]);

  const handleInstantExecution = useCallback(() => {
    setExecutionMode("instant");
    setIsAutoRunning(true);
  }, [setIsAutoRunning]);

  const handlePauseExecution = useCallback(() => {
    setIsAutoRunning(false);
  }, [setIsAutoRunning]);

  const handleResetExecution = useCallback(() => {
    setIsAutoRunning(false);
    setExecutionState(
      createEditorExecution(activeDiagramId, activeDiagramName),
    );
  }, [activeDiagramId, activeDiagramName, setExecutionState, setIsAutoRunning]);

  const handleInputConfirm = useCallback(
    (value: Parameters<typeof resumeFlowExecutionWithInput>[0]["value"]) => {
      setExecutionState((currentExecutionState) =>
        resumeFlowExecutionWithInput({
          state: currentExecutionState,
          value,
        }),
      );
    },
    [setExecutionState],
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
    [setExecutionState],
  );

  return {
    executionState,
    flowNodeRenderContextValue,
    handleFunctionParameterConfirm,
    handleInputConfirm,
    handlePauseExecution,
    handleResetExecution,
    handleRunExecution,
    handleInstantExecution,
    handleStepExecution,
    isAutoExecutionActive,
    isInstantExecutionActive:
      isAutoExecutionActive && executionMode === "instant",
    isAutoRunning,
    renderedEdges,
    resetExecutionForDiagram,
    setExecutionState,
    setIsAutoRunning,
  };
}

function getRenderedNodeExecutions({
  activeDecision,
  activeDiagramId,
  currentNodeId,
  currentDiagramId,
  visitedNodeIds,
}: {
  activeDecision: FlowExecutionState["activeDecision"];
  activeDiagramId: string;
  currentNodeId: FlowExecutionState["currentNodeId"];
  currentDiagramId: string;
  visitedNodeIds: string[];
}) {
  const executionsByNodeId = new Map<string, RenderedNodeExecution>();

  for (const nodeId of visitedNodeIds) {
    executionsByNodeId.set(nodeId, {
      isCurrent: false,
      isVisited: true,
      activeBranch: null,
    });
  }

  if (currentDiagramId !== activeDiagramId) return executionsByNodeId;

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
