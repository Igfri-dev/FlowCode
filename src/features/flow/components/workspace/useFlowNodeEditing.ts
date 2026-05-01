import { useCallback } from "react";
import type { Connection, useNodesState } from "@xyflow/react";
import type {
  ExerciseStarterEdge,
  ExerciseStarterFunction,
  ExerciseStarterNode,
} from "@/features/exercises/types";
import { createFlowEditorEdge } from "@/features/flow/flow-edge-factory";
import { getDefaultFlowNodeHandlePositions } from "@/features/flow/handle-positions";
import { getFlowNodeLabelFromConfig } from "@/features/flow/flow-node-factory";
import type { Language } from "@/features/i18n/translations";
import type {
  ImportedFlowFunctionDefinition,
  ImportedFlowNode,
} from "@/features/flow/parser";
import type {
  FlowEditorEdge,
  FlowEditorNode,
  FlowFunctionDefinition,
  FlowNodeConfig,
  FlowNodeHandlePositions,
} from "@/types/flow";

type SetNodes = ReturnType<typeof useNodesState<FlowEditorNode>>[1];

export function useFlowNodeEditing({
  language,
  setNodes,
}: {
  language: Language;
  setNodes: SetNodes;
}) {
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

  return {
    createEditorNodeFromImport,
    createEditorNodeFromStarter,
    createFunctionDefinitionFromImport,
    createFunctionDefinitionFromStarter,
    handleNodeConfigChange,
    handleNodeHandlePositionsChange,
    handleNodeLabelChange,
  };
}

export function createEditorEdgeFromStarter(
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
