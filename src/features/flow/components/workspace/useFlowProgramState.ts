import { useMemo, useState } from "react";
import { useEdgesState, useNodesState } from "@xyflow/react";
import { createFlowGraph, hasFlowCycles } from "@/features/flow/flow-graph";
import {
  initialFlowEdges,
  initialFlowNodes,
} from "@/features/flow/initial-diagram";
import { validateFlowDiagram } from "@/features/flow/flow-validation";
import type { useI18n } from "@/features/i18n/I18nProvider";
import type {
  FlowEditorNode,
  FlowFunctionDefinition,
  FlowProgram,
} from "@/types/flow";

type AvailableFlowFunctions = NonNullable<
  FlowEditorNode["data"]["availableFunctions"]
>;

export function useFlowProgramState({
  t,
}: {
  t: ReturnType<typeof useI18n>["t"];
}) {
  const [activeDiagramId, setActiveDiagramId] = useState("main");
  const [mainDiagram, setMainDiagram] = useState<FlowProgram["main"]>({
    nodes: initialFlowNodes,
    edges: initialFlowEdges,
  });
  const [functions, setFunctions] = useState<FlowFunctionDefinition[]>([]);
  const [nodes, setNodes] = useNodesState<FlowEditorNode>(initialFlowNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState(initialFlowEdges);
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
  const hasActiveDiagramContent = nodes.length > 0 || edges.length > 0;

  return {
    activeDiagramId,
    activeDiagramName,
    analysisNodes,
    availableFunctions,
    currentProgram,
    edges,
    functions,
    graph,
    hasActiveDiagramContent,
    hasLoops,
    mainDiagram,
    nodes,
    onEdgesChange,
    setActiveDiagramId,
    setEdges,
    setFunctions,
    setMainDiagram,
    setNodes,
    validationIssues,
  };
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
