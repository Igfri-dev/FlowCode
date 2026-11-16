import type { FlowHandlePosition } from "@/types/flow";
import {
  createOrthogonalRoute,
  getOrthogonalRoute,
  type OrthogonalRoute,
  type OrthogonalRouteOptions,
  type RouteObstacle,
  type RoutePoint,
} from "./orthogonal-routing";

export type RoutingConnection = {
  id: string;
  sourceId: string;
  targetId: string;
  source: OrthogonalRouteOptions["source"];
  target: OrthogonalRouteOptions["target"];
  targetHandleId?: string | null;
  hidden?: boolean;
};
export type ConvergingRoute = OrthogonalRoute & {
  branch?: OrthogonalRoute;
  trunk?: OrthogonalRoute;
  junctions?: RoutePoint[];
  sharedEdgeIds?: string[];
};

type JoinedBranch = {
  edge: RoutingConnection;
  branch: OrthogonalRoute;
  suffix: RoutePoint[];
  junction: RoutePoint;
};
const epsilon = 0.001;
const normals = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** Preserve every logical edge while drawing a single shared downstream trunk
 * for connections arriving at the exact same target port. The stable owner is
 * the only edge that paints that trunk and its final arrowhead.
 */
export function getConvergingRoutes({
  edges,
  obstacles,
}: {
  edges: RoutingConnection[];
  obstacles: RouteObstacle[];
}): Map<string, ConvergingRoute> {
  const routes = new Map<string, ConvergingRoute>();
  const groups = new Map<string, RoutingConnection[]>();
  const otherRoutes: RoutePoint[][] = [];
  for (const edge of [...edges].filter(validEdge).sort(compareEdges)) {
    const key = JSON.stringify([
      edge.targetId,
      edge.targetHandleId ?? null,
      edge.target.position,
      edge.target.x,
      edge.target.y,
    ]);
    const group = groups.get(key) ?? [];
    group.push(edge);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const forward = group.filter(
      (edge) => edge.sourceId !== edge.targetId && upstreamDistance(edge) > 24,
    );
    const shared =
      forward.length >= 2
        ? buildSharedGroup(forward, obstacles, otherRoutes)
        : null;
    if (shared) {
      for (const [id, route] of shared) {
        routes.set(id, route);
        if (route.branch) otherRoutes.push(route.branch.points);
        if (route.trunk) otherRoutes.push(route.trunk.points);
      }
    }
    for (const edge of group) {
      if (routes.has(edge.id)) continue;
      const route = getOrthogonalRoute({ ...edge, obstacles, otherRoutes });
      if (route) {
        routes.set(edge.id, route);
        otherRoutes.push(route.points);
      }
    }
  }
  return routes;
}

function buildSharedGroup(
  group: RoutingConnection[],
  obstacles: RouteObstacle[],
  otherRoutes: RoutePoint[][],
) {
  // Start upstream and extend toward the destination. With a top target this
  // naturally gives a vertical bus at target.x; the obstacle router can detour
  // the common bus instead of generating one parallel detour per feeder.
  const ordered = [...group].sort(
    (first, second) =>
      upstreamDistance(second) - upstreamDistance(first) ||
      Math.abs(first.source.x - first.target.x) +
        Math.abs(first.source.y - first.target.y) -
        Math.abs(second.source.x - second.target.x) -
        Math.abs(second.source.y - second.target.y) ||
      first.id.localeCompare(second.id),
  );
  const anchor = ordered[0];
  const anchorRoute = getOrthogonalRoute({ ...anchor, obstacles, otherRoutes });
  if (!anchorRoute || anchorRoute.points.length < 2) return null;
  const split = splitAtDistance(
    anchorRoute.points,
    Math.min(32, routeLength(anchorRoute.points) / 3),
  );
  if (!split || split.suffix.length < 2) return null;
  const trunkPoints = split.suffix;
  const joined: JoinedBranch[] = [
    {
      edge: anchor,
      branch: createOrthogonalRoute(split.prefix),
      suffix: split.suffix,
      junction: split.point,
    },
  ];

  for (const edge of ordered.slice(1)) {
    const branch = findJoiningBranch(edge, trunkPoints, obstacles, otherRoutes);
    if (branch) joined.push(branch);
  }
  if (joined.length < 2) return null;
  const owner = [...joined].sort((first, second) =>
    first.edge.id.localeCompare(second.edge.id),
  )[0].edge.id;
  const sharedEdgeIds = joined.map((item) => item.edge.id).sort();
  const junctions = uniquePoints(joined.map((item) => item.junction)).filter(
    (point) =>
      distance(point, trunkPoints[0]) > epsilon ||
      joined.filter((item) => distance(item.junction, point) < epsilon).length >
        1,
  );
  const trunk = createOrthogonalRoute(trunkPoints);
  return new Map(
    joined.map(({ edge, branch, suffix }) => {
      const full = createOrthogonalRoute([
        ...branch.points,
        ...suffix.slice(1),
      ]);
      return [
        edge.id,
        {
          ...full,
          labelX: branch.labelX,
          labelY: branch.labelY,
          branch,
          sharedEdgeIds,
          ...(edge.id === owner ? { trunk, junctions } : {}),
        } satisfies ConvergingRoute,
      ];
    }),
  );
}

function findJoiningBranch(
  edge: RoutingConnection,
  trunk: RoutePoint[],
  obstacles: RouteObstacle[],
  otherRoutes: RoutePoint[][],
): JoinedBranch | null {
  const candidates: Array<{ point: RoutePoint; side: FlowHandlePosition }> = [];
  for (let index = 1; index < trunk.length; index += 1) {
    const first = trunk[index - 1];
    const second = trunk[index];
    const vertical = Math.abs(first.x - second.x) < epsilon;
    const projected = vertical
      ? {
          x: first.x,
          y: clamp(
            edge.source.y + normals[edge.source.position].y * 32,
            first.y,
            second.y,
          ),
        }
      : {
          x: clamp(
            edge.source.x + normals[edge.source.position].x * 32,
            first.x,
            second.x,
          ),
          y: first.y,
        };
    const midpoint = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
    for (const point of [projected, first, midpoint, second]) {
      if (distance(point, edge.target) < 20) continue;
      const side = vertical
        ? edge.source.x < point.x
          ? "left"
          : "right"
        : edge.source.y < point.y
          ? "top"
          : "bottom";
      candidates.push({ point, side });
      // A source aligned with the bus can merge collinearly without a detour.
      if (vertical && Math.abs(edge.source.x - point.x) < epsilon) {
        candidates.push({
          point,
          side: edge.source.y < point.y ? "top" : "bottom",
        });
      } else if (!vertical && Math.abs(edge.source.y - point.y) < epsilon) {
        candidates.push({
          point,
          side: edge.source.x < point.x ? "left" : "right",
        });
      }
    }
  }
  let best: JoinedBranch | null = null;
  let bestCost = Infinity;
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = JSON.stringify([candidate.point, candidate.side]);
    if (seen.has(key)) continue;
    seen.add(key);
    const route = getOrthogonalRoute({
      sourceId: edge.sourceId,
      targetId: `__junction:${edge.id}`,
      source: edge.source,
      target: { ...candidate.point, position: candidate.side },
      obstacles,
      otherRoutes,
    });
    if (!route) continue;
    const joined = trimAtFirstIntersection(route.points, trunk);
    if (!joined) continue;
    const cost = routeLength(joined.prefix) + joined.prefix.length * 18;
    if (cost >= bestCost) continue;
    bestCost = cost;
    best = {
      edge,
      branch: createOrthogonalRoute(joined.prefix),
      suffix: joined.suffix,
      junction: joined.point,
    };
  }
  return best;
}

function trimAtFirstIntersection(branch: RoutePoint[], trunk: RoutePoint[]) {
  for (let branchIndex = 1; branchIndex < branch.length; branchIndex += 1) {
    const from = branch[branchIndex - 1];
    const to = branch[branchIndex];
    const intersections: Array<{ point: RoutePoint; trunkIndex: number }> = [];
    for (let trunkIndex = 1; trunkIndex < trunk.length; trunkIndex += 1) {
      const point = segmentIntersection(
        from,
        to,
        trunk[trunkIndex - 1],
        trunk[trunkIndex],
      );
      if (point && (branchIndex > 1 || distance(point, branch[0]) > epsilon)) {
        intersections.push({ point, trunkIndex });
      }
    }
    intersections.sort(
      (first, second) =>
        distance(from, first.point) - distance(from, second.point),
    );
    const intersection = intersections[0];
    if (intersection)
      return {
        point: intersection.point,
        prefix: [...branch.slice(0, branchIndex), intersection.point],
        suffix: [intersection.point, ...trunk.slice(intersection.trunkIndex)],
      };
  }
  return null;
}

function segmentIntersection(
  a: RoutePoint,
  b: RoutePoint,
  c: RoutePoint,
  d: RoutePoint,
): RoutePoint | null {
  const av = Math.abs(a.x - b.x) < epsilon;
  const cv = Math.abs(c.x - d.x) < epsilon;
  if (av !== cv) {
    const point = av ? { x: a.x, y: c.y } : { x: c.x, y: a.y };
    return onSegment(point, a, b) && onSegment(point, c, d) ? point : null;
  }
  if (av ? Math.abs(a.x - c.x) > epsilon : Math.abs(a.y - c.y) > epsilon)
    return null;
  if (onSegment(a, c, d)) return a;
  const candidates = [c, d].filter((point) => onSegment(point, a, b));
  return (
    candidates.sort(
      (first, second) => distance(a, first) - distance(a, second),
    )[0] ?? null
  );
}
function onSegment(point: RoutePoint, from: RoutePoint, to: RoutePoint) {
  return (
    point.x >= Math.min(from.x, to.x) - epsilon &&
    point.x <= Math.max(from.x, to.x) + epsilon &&
    point.y >= Math.min(from.y, to.y) - epsilon &&
    point.y <= Math.max(from.y, to.y) + epsilon
  );
}
function splitAtDistance(points: RoutePoint[], requested: number) {
  let remaining = requested;
  for (let index = 1; index < points.length; index += 1) {
    const length = distance(points[index - 1], points[index]);
    if (length < epsilon) continue;
    if (remaining <= length) {
      const first = points[index - 1];
      const second = points[index];
      const point = {
        x: first.x + ((second.x - first.x) * remaining) / length,
        y: first.y + ((second.y - first.y) * remaining) / length,
      };
      return {
        point,
        prefix: [...points.slice(0, index), point],
        suffix: [point, ...points.slice(index)],
      };
    }
    remaining -= length;
  }
  return null;
}
function routeLength(points: RoutePoint[]) {
  return points
    .slice(1)
    .reduce((sum, point, index) => sum + distance(points[index], point), 0);
}
function distance(first: RoutePoint, second: RoutePoint) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}
function clamp(value: number, first: number, second: number) {
  return Math.max(
    Math.min(first, second),
    Math.min(Math.max(first, second), value),
  );
}
function uniquePoints(points: RoutePoint[]) {
  return points.filter(
    (point, index) =>
      points.findIndex((other) => distance(point, other) < epsilon) === index,
  );
}
function upstreamDistance(edge: RoutingConnection) {
  const normal = normals[edge.target.position];
  return (
    (edge.source.x - edge.target.x) * normal.x +
    (edge.source.y - edge.target.y) * normal.y
  );
}
function validEdge(edge: RoutingConnection) {
  return (
    !edge.hidden &&
    [edge.source.x, edge.source.y, edge.target.x, edge.target.y].every(
      Number.isFinite,
    )
  );
}
function compareEdges(first: RoutingConnection, second: RoutingConnection) {
  const firstBack = upstreamDistance(first) < 0 ? 1_000_000 : 0;
  const secondBack = upstreamDistance(second) < 0 ? 1_000_000 : 0;
  return (
    firstBack - secondBack ||
    distance(first.source, first.target) -
      distance(second.source, second.target) ||
    first.id.localeCompare(second.id)
  );
}
