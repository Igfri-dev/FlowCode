import { useCallback } from "react";
import {
  Position,
  useStore,
  type InternalNode,
  type ReactFlowState,
} from "@xyflow/react";
import {
  getConvergingRoutes,
  type ConvergingRoute,
  type RoutingConnection,
} from "./converging-routing";

type Route = ConvergingRoute;
type RouteInput = Parameters<typeof getConvergingRoutes>[0];
type Endpoint = RoutingConnection["source"];
type MeasuredHandle = {
  id?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  position: Position;
};
type RoutingNode = {
  id: string;
  obstacle: RouteInput["obstacles"][number];
  sources: Array<{ id?: string | null; endpoint: Endpoint }>;
  targets: Array<{ id?: string | null; endpoint: Endpoint }>;
};
type RoutingEdge = RoutingConnection;
type RoutingCache = { key: string; routes: Map<string, Route> };

// One routing pass per diagram geometry, shared by all edge components. Viewport,
// selection and execution updates reuse the routes; no coordinates enter saved JSON.
const routingCaches = new WeakMap<object, RoutingCache>();

export function useFlowEdgeRouting(edgeId: string) {
  const selector = useCallback(
    (state: ReactFlowState) => getDiagramRoutes(state).get(edgeId),
    [edgeId],
  );
  return useStore(selector);
}

export function useSharedTrunkAppearance(edgeIds: string[] | undefined) {
  const selector = useCallback(
    (state: ReactFlowState) => {
      if (!edgeIds) return undefined;
      const members = state.edges.filter((edge) => edgeIds.includes(edge.id));
      return (
        members.find((edge) => edge.animated) ??
        members.find((edge) => edge.selected) ??
        members.find(
          (edge) => edge.style?.stroke && edge.style.stroke !== "#525252",
        ) ??
        members[0]
      );
    },
    [edgeIds],
  );
  return useStore(selector);
}

function getDiagramRoutes(state: ReactFlowState) {
  const nodes = Array.from(state.nodeLookup.values())
    .filter((node) => !node.hidden)
    .map(toRoutingNode);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges: RoutingEdge[] = [];

  for (const edge of state.edges) {
    if (edge.hidden) continue;
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    const source = findEndpoint(sourceNode?.sources, edge.sourceHandle);
    const target =
      findEndpoint(targetNode?.targets, edge.targetHandle) ??
      findEndpoint(targetNode?.sources, edge.targetHandle);
    if (source && target) {
      edges.push({
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        targetHandleId: edge.targetHandle,
        source,
        target,
      });
    }
  }

  const obstacles = nodes.map((node) => node.obstacle);
  const key = JSON.stringify([obstacles, edges]);
  const previous = routingCaches.get(state.nodeLookup);
  if (previous?.key === key) return previous.routes;

  const routes = getConvergingRoutes({ edges, obstacles });
  routingCaches.set(state.nodeLookup, { key, routes });
  return routes;
}

function toRoutingNode(node: InternalNode): RoutingNode {
  const { x, y } = node.internals.positionAbsolute;
  const width = node.measured.width ?? node.width ?? 0;
  const height = node.measured.height ?? node.height ?? 0;
  // The input/output silhouette extends beyond its untransformed handle box.
  const skewPadding =
    node.type === "input" || node.type === "output"
      ? (Math.tan((8 * Math.PI) / 180) * height) / 2
      : 0;
  const mapHandle = (handle: MeasuredHandle) => ({
    id: handle.id,
    endpoint: getEndpoint(x, y, handle),
  });
  return {
    id: node.id,
    obstacle: {
      id: node.id,
      left: x - skewPadding,
      top: y,
      right: x + width + skewPadding,
      bottom: y + height,
    },
    sources: (node.internals.handleBounds?.source ?? []).map(mapHandle),
    targets: (node.internals.handleBounds?.target ?? []).map(mapHandle),
  };
}

function findEndpoint(
  handles: RoutingNode["sources"] | undefined,
  id: string | null | undefined,
) {
  return (id ? handles?.find((handle) => handle.id === id) : handles?.[0])
    ?.endpoint;
}

function getEndpoint(x: number, y: number, handle: MeasuredHandle): Endpoint {
  return {
    x:
      x +
      handle.x +
      (handle.position === Position.Left
        ? 0
        : handle.position === Position.Right
          ? handle.width
          : handle.width / 2),
    y:
      y +
      handle.y +
      (handle.position === Position.Top
        ? 0
        : handle.position === Position.Bottom
          ? handle.height
          : handle.height / 2),
    position: handle.position,
  };
}
