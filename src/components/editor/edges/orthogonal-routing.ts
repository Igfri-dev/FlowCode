import type { FlowHandlePosition } from "@/types/flow";

export type RoutePoint = { x: number; y: number };
export type RouteObstacle = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};
type Port = RoutePoint & { position: FlowHandlePosition };
export type OrthogonalRoute = {
  points: RoutePoint[];
  path: string;
  labelX: number;
  labelY: number;
};
export type OrthogonalRouteOptions = {
  source: Port;
  target: Port;
  sourceId: string;
  targetId: string;
  obstacles: RouteObstacle[];
  otherRoutes?: RoutePoint[][];
  clearance?: number;
};

/** Build an SVG route after splitting or joining already validated segments. */
export function createOrthogonalRoute(
  points: RoutePoint[],
  cornerRadius = 0,
): OrthogonalRoute {
  return createRoute(simplify(points), cornerRadius);
}

const epsilon = 0.001;
const bendPenalty = 28;
const crossingPenalty = 240;
const vectors = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];
const sideDirection = { right: 0, bottom: 1, left: 2, top: 3 } as const;

/** A rectilinear visibility grid keeps connectors outside measured block bounds.
 * Routes are recalculated from current ports, so dragging/resizing cannot leave
 * stale waypoints attached to a previous node position.
 */
export function getOrthogonalRoute(
  options: OrthogonalRouteOptions,
): OrthogonalRoute | null {
  if (
    ![
      options.source.x,
      options.source.y,
      options.target.x,
      options.target.y,
    ].every(Number.isFinite)
  ) {
    return null;
  }
  const sourceDirection = sideDirection[options.source.position];
  const targetDirection = sideDirection[options.target.position];
  const aligned =
    Math.abs(options.source.x - options.target.x) < epsilon ||
    Math.abs(options.source.y - options.target.y) < epsilon;
  if (
    aligned &&
    manhattan(options.source, options.target) > epsilon &&
    directionOf(options.source, options.target) === sourceDirection &&
    targetDirection === (sourceDirection + 2) % 4 &&
    segmentClear(options.source, options.target, options.obstacles) &&
    segmentCrossingCost(
      options.source,
      options.target,
      options.otherRoutes ?? [],
    ) === 0
  ) {
    // Opposing ports in a very narrow gap do not need two overlapping stubs.
    return createRoute(simplify([options.source, options.target]), 0);
  }
  const clearance = Math.max(0, options.clearance ?? 18);
  // A narrow corridor may not accommodate the preferred margin. Reduce it
  // before giving up, while still never routing through the block itself.
  for (const margin of [...new Set([clearance, Math.min(clearance, 6), 0])]) {
    const points = routeWithClearance(options, margin);
    if (points) return createRoute(points, Math.min(7, margin));
  }
  return null;
}

function routeWithClearance(
  options: OrthogonalRouteOptions,
  clearance: number,
) {
  const { source, target, sourceId, targetId, otherRoutes = [] } = options;
  const obstacles = options.obstacles
    .filter(
      (rect) =>
        [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite) &&
        rect.right > rect.left &&
        rect.bottom > rect.top,
    )
    .map((rect) => ({
      ...rect,
      left: rect.left - clearance,
      right: rect.right + clearance,
      top: rect.top - clearance,
      bottom: rect.bottom + clearance,
    }));
  const sourceRect = obstacles.find((rect) => rect.id === sourceId);
  const targetRect = obstacles.find((rect) => rect.id === targetId);
  const from = getEscape(source, sourceRect, clearance);
  const to = getEscape(target, targetRect, clearance);
  if (
    !segmentClear(
      source,
      from,
      obstacles.filter((rect) => rect.id !== sourceId),
    ) ||
    !segmentClear(
      to,
      target,
      obstacles.filter((rect) => rect.id !== targetId),
    ) ||
    obstacles.some((rect) => pointInside(from, rect) || pointInside(to, rect))
  )
    return null;

  const startDirection = sideDirection[source.position];
  const endDirection = (sideDirection[target.position] + 2) % 4;
  const candidates = getSimpleCandidates(from, to, obstacles, otherRoutes)
    .filter((points) =>
      validPortDirections(points, startDirection, endDirection),
    )
    .filter((points) =>
      points
        .slice(1)
        .every((point, index) => segmentClear(points[index], point, obstacles)),
    )
    .map((points) => ({
      points,
      cost: routeCost(points, otherRoutes, startDirection, endDirection),
    }))
    .sort((first, second) => first.cost - second.cost);
  const bestSimple = candidates[0];
  // In the usual case of a forward connection, avoid building a search grid.
  if (bestSimple && crossingCost(bestSimple.points, otherRoutes) === 0) {
    return simplify([source, ...bestSimple.points, target]);
  }
  const searched = searchGrid(
    from,
    to,
    obstacles,
    otherRoutes,
    startDirection,
    endDirection,
  );
  if (!searched)
    return bestSimple ? simplify([source, ...bestSimple.points, target]) : null;
  const best =
    !bestSimple ||
    routeCost(searched, otherRoutes, startDirection, endDirection) <
      bestSimple.cost
      ? searched
      : bestSimple.points;
  return simplify([source, ...best, target]);
}

function getEscape(
  port: Port,
  rect: RouteObstacle | undefined,
  clearance: number,
): RoutePoint {
  const stub = Math.max(20, clearance);
  switch (port.position) {
    case "left":
      return {
        x: Math.min(port.x - stub, rect?.left ?? port.x - stub),
        y: port.y,
      };
    case "right":
      return {
        x: Math.max(port.x + stub, rect?.right ?? port.x + stub),
        y: port.y,
      };
    case "top":
      return {
        x: port.x,
        y: Math.min(port.y - stub, rect?.top ?? port.y - stub),
      };
    case "bottom":
      return {
        x: port.x,
        y: Math.max(port.y + stub, rect?.bottom ?? port.y + stub),
      };
  }
}

function getSimpleCandidates(
  from: RoutePoint,
  to: RoutePoint,
  obstacles: RouteObstacle[],
  otherRoutes: RoutePoint[][],
): RoutePoint[][] {
  const candidates: RoutePoint[][] = [];
  if (Math.abs(from.x - to.x) < epsilon || Math.abs(from.y - to.y) < epsilon)
    candidates.push([from, to]);
  candidates.push(
    [from, { x: to.x, y: from.y }, to],
    [from, { x: from.x, y: to.y }, to],
  );
  const xs = new Set([(from.x + to.x) / 2]);
  const ys = new Set([(from.y + to.y) / 2]);
  for (const rect of obstacles) {
    xs.add(rect.left);
    xs.add(rect.right);
    ys.add(rect.top);
    ys.add(rect.bottom);
  }
  addRouteChannels(xs, ys, otherRoutes);
  for (const x of xs)
    candidates.push([from, { x, y: from.y }, { x, y: to.y }, to]);
  for (const y of ys)
    candidates.push([from, { x: from.x, y }, { x: to.x, y }, to]);
  return candidates.map(simplify);
}

function searchGrid(
  from: RoutePoint,
  to: RoutePoint,
  obstacles: RouteObstacle[],
  otherRoutes: RoutePoint[][],
  startDirection: number,
  endDirection: number,
) {
  const xs = new Set([from.x, to.x]);
  const ys = new Set([from.y, to.y]);
  for (const rect of obstacles) {
    xs.add(rect.left);
    xs.add(rect.right);
    ys.add(rect.top);
    ys.add(rect.bottom);
  }
  addRouteChannels(xs, ys, otherRoutes);
  // Outside channels also handle upward loop returns and same-side ports.
  xs.add(Math.min(...xs) - 32);
  xs.add(Math.max(...xs) + 32);
  ys.add(Math.min(...ys) - 32);
  ys.add(Math.max(...ys) + 32);
  const xValues = [...xs].sort((a, b) => a - b);
  const yValues = [...ys].sort((a, b) => a - b);
  const width = xValues.length;
  const startCell = yValues.indexOf(from.y) * width + xValues.indexOf(from.x);
  const goalCell = yValues.indexOf(to.y) * width + xValues.indexOf(to.x);
  const stateCount = width * yValues.length * 4;
  const distances = new Float64Array(stateCount).fill(Infinity);
  const parents = new Int32Array(stateCount).fill(-1);
  const closed = new Uint8Array(stateCount);
  const blocked = new Int8Array(width * yValues.length).fill(-1);
  const point = (cell: number): RoutePoint => ({
    x: xValues[cell % width],
    y: yValues[Math.floor(cell / width)],
  });
  const isBlocked = (cell: number) => {
    if (blocked[cell] < 0)
      blocked[cell] = obstacles.some((rect) => pointInside(point(cell), rect))
        ? 1
        : 0;
    return blocked[cell] === 1;
  };
  const start = startCell * 4 + startDirection;
  distances[start] = 0;
  const queue = new MinHeap();
  queue.push(start, manhattan(from, to));
  let goal = -1;
  while (queue.size) {
    const current = queue.pop();
    if (closed[current]) continue;
    closed[current] = 1;
    const cell = Math.floor(current / 4);
    const previousDirection = current % 4;
    if (cell === goalCell && previousDirection !== (endDirection + 2) % 4) {
      goal = current;
      break;
    }
    const x = cell % width;
    const y = Math.floor(cell / width);
    const currentPoint = point(cell);
    for (let direction = 0; direction < 4; direction += 1) {
      if (direction === (previousDirection + 2) % 4) continue;
      const vector = vectors[direction];
      const nextX = x + vector.x;
      const nextY = y + vector.y;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= yValues.length)
        continue;
      const nextCell = nextY * width + nextX;
      if (isBlocked(nextCell)) continue;
      const nextPoint = point(nextCell);
      if (!segmentClear(currentPoint, nextPoint, obstacles)) continue;
      const nextState = nextCell * 4 + direction;
      const cost =
        distances[current] +
        manhattan(currentPoint, nextPoint) +
        (direction !== previousDirection ? bendPenalty : 0) +
        segmentCrossingCost(currentPoint, nextPoint, otherRoutes);
      if (cost + epsilon >= distances[nextState]) continue;
      distances[nextState] = cost;
      parents[nextState] = current;
      queue.push(nextState, cost + manhattan(nextPoint, to));
    }
  }
  if (goal < 0) return null;
  const points: RoutePoint[] = [];
  for (let cursor = goal; cursor >= 0; cursor = parents[cursor])
    points.push(point(Math.floor(cursor / 4)));
  return simplify(points.reverse());
}

function addRouteChannels(
  xs: Set<number>,
  ys: Set<number>,
  routes: RoutePoint[][],
) {
  for (const route of routes) {
    for (const point of route) {
      xs.add(point.x - 16);
      xs.add(point.x + 16);
      ys.add(point.y - 16);
      ys.add(point.y + 16);
    }
  }
}

function validPortDirections(points: RoutePoint[], start: number, end: number) {
  if (points.length < 2) return false;
  for (let index = 2; index < points.length; index += 1) {
    const before = directionOf(points[index - 2], points[index - 1]);
    const after = directionOf(points[index - 1], points[index]);
    if (after === (before + 2) % 4) return false;
  }
  return (
    directionOf(points[0], points[1]) !== (start + 2) % 4 &&
    directionOf(points[points.length - 2], points[points.length - 1]) !==
      (end + 2) % 4
  );
}

function pointInside(point: RoutePoint, rect: RouteObstacle) {
  return (
    point.x > rect.left + epsilon &&
    point.x < rect.right - epsilon &&
    point.y > rect.top + epsilon &&
    point.y < rect.bottom - epsilon
  );
}

function segmentClear(
  from: RoutePoint,
  to: RoutePoint,
  obstacles: RouteObstacle[],
) {
  if (Math.abs(from.x - to.x) < epsilon) {
    return !obstacles.some(
      (rect) =>
        from.x > rect.left + epsilon &&
        from.x < rect.right - epsilon &&
        Math.max(from.y, to.y) > rect.top + epsilon &&
        Math.min(from.y, to.y) < rect.bottom - epsilon,
    );
  }
  if (Math.abs(from.y - to.y) < epsilon) {
    return !obstacles.some(
      (rect) =>
        from.y > rect.top + epsilon &&
        from.y < rect.bottom - epsilon &&
        Math.max(from.x, to.x) > rect.left + epsilon &&
        Math.min(from.x, to.x) < rect.right - epsilon,
    );
  }
  return false;
}

function routeCost(
  points: RoutePoint[],
  routes: RoutePoint[][],
  start: number,
  end: number,
) {
  let cost = 0;
  let previous = start;
  for (let index = 1; index < points.length; index += 1) {
    const direction = directionOf(points[index - 1], points[index]);
    cost +=
      manhattan(points[index - 1], points[index]) +
      (direction !== previous ? bendPenalty : 0);
    previous = direction;
  }
  return (
    cost + (previous !== end ? bendPenalty : 0) + crossingCost(points, routes)
  );
}

function crossingCost(points: RoutePoint[], routes: RoutePoint[][]) {
  return points
    .slice(1)
    .reduce(
      (cost, point, index) =>
        cost + segmentCrossingCost(points[index], point, routes),
      0,
    );
}

function segmentCrossingCost(
  from: RoutePoint,
  to: RoutePoint,
  routes: RoutePoint[][],
) {
  let cost = 0;
  const horizontal = Math.abs(from.y - to.y) < epsilon;
  for (const route of routes) {
    for (let index = 1; index < route.length; index += 1) {
      const first = route[index - 1];
      const second = route[index];
      const otherHorizontal = Math.abs(first.y - second.y) < epsilon;
      if (horizontal !== otherHorizontal) {
        // Include this grid segment's endpoints: otherwise splitting at a
        // visibility line would make a real crossing invisible to A*.
        const crosses = horizontal
          ? within(first.x, from.x, to.x) && between(from.y, first.y, second.y)
          : within(first.y, from.y, to.y) && between(from.x, first.x, second.x);
        if (crosses) cost += crossingPenalty;
      } else if (
        horizontal
          ? Math.abs(from.y - first.y) < epsilon
          : Math.abs(from.x - first.x) < epsilon
      ) {
        const overlap = horizontal
          ? Math.min(Math.max(from.x, to.x), Math.max(first.x, second.x)) -
            Math.max(Math.min(from.x, to.x), Math.min(first.x, second.x))
          : Math.min(Math.max(from.y, to.y), Math.max(first.y, second.y)) -
            Math.max(Math.min(from.y, to.y), Math.min(first.y, second.y));
        if (overlap > epsilon) cost += overlap * 0.8;
      }
    }
  }
  return cost;
}

function between(value: number, first: number, second: number) {
  return (
    value > Math.min(first, second) + epsilon &&
    value < Math.max(first, second) - epsilon
  );
}
function within(value: number, first: number, second: number) {
  return (
    value >= Math.min(first, second) - epsilon &&
    value <= Math.max(first, second) + epsilon
  );
}
function manhattan(first: RoutePoint, second: RoutePoint) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}
function directionOf(first: RoutePoint, second: RoutePoint) {
  return Math.abs(first.x - second.x) < epsilon
    ? second.y > first.y
      ? 1
      : 3
    : second.x > first.x
      ? 0
      : 2;
}
function simplify(points: RoutePoint[]) {
  const result: RoutePoint[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (last && manhattan(last, point) < epsilon) continue;
    const previous = result[result.length - 2];
    if (
      previous &&
      last &&
      directionOf(previous, last) === directionOf(last, point)
    )
      result.pop();
    result.push({ x: point.x, y: point.y });
  }
  return result;
}
function createRoute(
  points: RoutePoint[],
  cornerRadius: number,
): OrthogonalRoute {
  // Use the centre of the longest segment for a legible label off the bends.
  let longest = -1;
  let labelX = points[0].x;
  let labelY = points[0].y;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const length = manhattan(previous, current);
    if (length > longest) {
      longest = length;
      labelX = (previous.x + current.x) / 2;
      labelY = (previous.y + current.y) / 2;
    }
    const next = points[index + 1];
    if (!next) {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }
    const radius = Math.min(
      cornerRadius,
      length / 2,
      manhattan(current, next) / 2,
    );
    const before = moveToward(current, previous, radius);
    const after = moveToward(current, next, radius);
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  return { points, path, labelX, labelY };
}
function moveToward(from: RoutePoint, to: RoutePoint, distance: number) {
  const length = manhattan(from, to);
  return {
    x: from.x + ((to.x - from.x) * distance) / length,
    y: from.y + ((to.y - from.y) * distance) / length,
  };
}

class MinHeap {
  private values: Array<{ id: number; priority: number }> = [];
  get size() {
    return this.values.length;
  }
  push(id: number, priority: number) {
    const value = { id, priority };
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].priority <= priority) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }
  pop() {
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length && last) {
      let index = 0;
      while (index * 2 + 1 < this.values.length) {
        let child = index * 2 + 1;
        if (
          child + 1 < this.values.length &&
          this.values[child + 1].priority < this.values[child].priority
        )
          child += 1;
        if (last.priority <= this.values[child].priority) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = last;
    }
    return first.id;
  }
}
