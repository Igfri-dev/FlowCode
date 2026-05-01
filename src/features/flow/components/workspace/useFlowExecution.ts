import { useCallback, useEffect, useMemo, useState } from "react";
import {
  initialFlowExecutionState,
  resetFlowExecution,
  resumeFlowExecutionWithFunctionParameters,
  resumeFlowExecutionWithInput,
  stepFlowExecution,
  type FlowExecutionState,
} from "@/features/flow/execution";
import type { useI18n } from "@/features/i18n/I18nProvider";
import type {
  FlowEditorEdge,
  FlowEditorNode,
  FlowProgram,
} from "@/types/flow";

type AvailableFlowFunctions = NonNullable<
  FlowEditorNode["data"]["availableFunctions"]
>;
type RenderedNodeExecution = NonNullable<
  FlowEditorNode["data"]["execution"]
>;

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
  const [executionState, setExecutionState] = useState(
    initialFlowExecutionState,
  );
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const canContinueExecution =
    executionState.status !== "finished" &&
    executionState.status !== "error" &&
    executionState.status !== "waitingInput" &&
    executionState.status !== "waitingFunctionParameters";
  const isAutoExecutionActive = isAutoRunning && canContinueExecution;
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

  const resetExecutionForDiagram = useCallback((diagramId: string, name: string) => {
    setExecutionState(resetFlowExecution(diagramId, name));
  }, []);

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

  return {
    executionState,
    flowNodeRenderContextValue,
    handleFunctionParameterConfirm,
    handleInputConfirm,
    handlePauseExecution,
    handleResetExecution,
    handleRunExecution,
    handleStepExecution,
    isAutoExecutionActive,
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
