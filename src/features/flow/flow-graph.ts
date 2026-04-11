import type { FlowEditorNode } from "@/types/flow";

export type FlowConnectionLike = {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type FlowGraph = {
  nodeById: Map<string, FlowEditorNode>;
  nodes: FlowEditorNode[];
  edges: FlowConnectionLike[];
  incomingEdgesByNodeId: Map<string, FlowConnectionLike[]>;
  outgoingEdgesByNodeId: Map<string, FlowConnectionLike[]>;
  outgoingEdgesBySourceHandle: Map<string, Map<string, FlowConnectionLike[]>>;
};

export function createFlowGraph(
  nodes: FlowEditorNode[],
  edges: FlowConnectionLike[],
): FlowGraph {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incomingEdgesByNodeId = new Map<string, FlowConnectionLike[]>();
  const outgoingEdgesByNodeId = new Map<string, FlowConnectionLike[]>();
  const outgoingEdgesBySourceHandle = new Map<
    string,
    Map<string, FlowConnectionLike[]>
  >();

  for (const node of nodes) {
    incomingEdgesByNodeId.set(node.id, []);
    outgoingEdgesByNodeId.set(node.id, []);
    outgoingEdgesBySourceHandle.set(node.id, new Map());
  }

  for (const edge of edges) {
    incomingEdgesByNodeId.get(edge.target)?.push(edge);
    outgoingEdgesByNodeId.get(edge.source)?.push(edge);

    const handleEdgesById = outgoingEdgesBySourceHandle.get(edge.source);
    const sourceHandle = edge.sourceHandle ?? "default";
    const handleEdges = handleEdgesById?.get(sourceHandle) ?? [];

    handleEdges.push(edge);
    handleEdgesById?.set(sourceHandle, handleEdges);
  }

  return {
    nodeById,
    nodes,
    edges,
    incomingEdgesByNodeId,
    outgoingEdgesByNodeId,
    outgoingEdgesBySourceHandle,
  };
}

export function getIncomingEdges(graph: FlowGraph, nodeId: string) {
  return graph.incomingEdgesByNodeId.get(nodeId) ?? [];
}

export function getOutgoingEdges(graph: FlowGraph, nodeId: string) {
  return graph.outgoingEdgesByNodeId.get(nodeId) ?? [];
}

export function getOutgoingEdgesByHandle(
  graph: FlowGraph,
  nodeId: string,
  sourceHandle: string,
) {
  return graph.outgoingEdgesBySourceHandle.get(nodeId)?.get(sourceHandle) ?? [];
}

export function hasFlowCycles(graph: FlowGraph) {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);

    for (const edge of getOutgoingEdges(graph, nodeId)) {
      if (!graph.nodeById.has(edge.target)) {
        continue;
      }

      if (visit(edge.target)) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);

    return false;
  }

  return graph.nodes.some((node) => visit(node.id));
}
