import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getConvergingRoutes,
  type RoutingConnection,
  type ConvergingRoute,
} from "@/components/editor/edges/converging-routing";
import type {
  RouteObstacle,
  RoutePoint,
} from "@/components/editor/edges/orthogonal-routing";

function fiveFeeders() {
  const sources = Array.from({ length: 5 }, (_, index) => ({
    id: `source-${index}`,
    left: index * 220,
    right: index * 220 + 140,
    top: index * 130,
    bottom: index * 130 + 60,
  }));
  const target = {
    id: "target",
    left: 100,
    right: 240,
    top: 950,
    bottom: 1010,
  };
  const edges: RoutingConnection[] = sources.map((source, index) => ({
    id: `edge-${index}`,
    sourceId: source.id,
    targetId: target.id,
    source: {
      x: (source.left + source.right) / 2,
      y: source.bottom,
      position: "bottom",
    },
    target: { x: 170, y: 950, position: "top" },
    targetHandleId: "in",
  }));
  return { edges, obstacles: [...sources, target] };
}

describe("shared downstream trunks", () => {
  it("merges five feeders into one owned trunk while preserving every full edge", () => {
    const input = fiveFeeders();
    const routes = getConvergingRoutes(input);
    assert.equal(routes.size, 5);
    const owners = [...routes.values()].filter((route) => route.trunk);
    assert.equal(owners.length, 1);
    const trunk = owners[0].trunk;
    assert.ok(trunk);
    assert.equal(routes.get("edge-0")?.trunk, trunk);
    for (const edge of input.edges) {
      const route = routes.get(edge.id);
      assert.ok(route?.branch);
      assert.deepEqual(route.points[0], { x: edge.source.x, y: edge.source.y });
      assert.deepEqual(route.points.at(-1), {
        x: edge.target.x,
        y: edge.target.y,
      });
      assert.ok(onPolyline(route.branch.points.at(-1)!, trunk.points));
      assert.deepEqual(
        route.sharedEdgeIds,
        input.edges.map((item) => item.id),
      );
      assertClear(route.points, input.obstacles);
      assertClear(route.branch.points, input.obstacles);
    }
    assertClear(trunk.points, input.obstacles);
  });

  it("detours the common bus around an obstacle instead of intersecting it", () => {
    const input = fiveFeeders();
    const blocker = {
      id: "blocker",
      left: 70,
      right: 270,
      top: 650,
      bottom: 790,
    };
    input.obstacles.push(blocker);
    const routes = getConvergingRoutes(input);
    const trunk = [...routes.values()].find((route) => route.trunk)?.trunk;
    assert.ok(trunk);
    assertClear(trunk.points, input.obstacles);
    assert.ok(
      trunk.points.some(
        (point) => point.x < blocker.left || point.x > blocker.right,
      ),
    );
    for (const route of routes.values())
      assertClear(route.points, input.obstacles);
  });

  it("does not combine distinct ports on the same target, including coincident ports", () => {
    const input = fiveFeeders();
    const edges = input.edges
      .slice(0, 2)
      .map((edge, index) => ({ ...edge, targetHandleId: `in-${index}` }));
    const routes = getConvergingRoutes({ ...input, edges });
    assert.equal(routes.size, 2);
    assert.ok(
      [...routes.values()].every((route) => !route.trunk && !route.branch),
    );
  });

  it("keeps owner, routes and junctions stable when edge array order changes", () => {
    const input = fiveFeeders();
    const first = getConvergingRoutes(input);
    const reversed = getConvergingRoutes({
      ...input,
      edges: [...input.edges].reverse(),
    });
    assert.deepEqual([...first], [...reversed]);
  });

  it("updates every full endpoint and the common trunk after the target moves", () => {
    const input = fiveFeeders();
    const moved = {
      edges: input.edges.map((edge) => ({
        ...edge,
        target: {
          ...edge.target,
          x: edge.target.x + 160,
          y: edge.target.y + 100,
        },
      })),
      obstacles: input.obstacles.map((rect) =>
        rect.id === "target"
          ? {
              ...rect,
              left: rect.left + 160,
              right: rect.right + 160,
              top: rect.top + 100,
              bottom: rect.bottom + 100,
            }
          : rect,
      ),
    };
    const routes = getConvergingRoutes(moved);
    assert.equal(routes.size, input.edges.length);
    for (const edge of moved.edges) {
      const route = routes.get(edge.id);
      assert.ok(route);
      assert.deepEqual(route.points.at(-1), {
        x: edge.target.x,
        y: edge.target.y,
      });
      if (route.trunk)
        assert.deepEqual(route.trunk.points.at(-1), {
          x: edge.target.x,
          y: edge.target.y,
        });
      assertClear(route.points, moved.obstacles);
    }
  });

  it("keeps loops individual and ignores hidden or invalid connections without losing visible ones", () => {
    const input = fiveFeeders();
    const edges: RoutingConnection[] = [
      input.edges[0],
      { ...input.edges[1], hidden: true },
      { ...input.edges[2], source: { ...input.edges[2].source, x: NaN } },
      {
        ...input.edges[3],
        sourceId: "loop",
        source: { x: 950, y: 1100, position: "top" },
      },
    ];
    const routes = getConvergingRoutes({
      ...input,
      edges,
      obstacles: [
        ...input.obstacles,
        { id: "loop", left: 900, right: 1000, top: 1100, bottom: 1160 },
      ],
    });
    assert.equal(routes.size, 2);
    assert.ok(routes.has(edges[0].id));
    assert.ok(routes.has(edges[3].id));
    assert.ok([...routes.values()].every((route) => !route.trunk));
  });

  it("supports destinations approached horizontally", () => {
    const input = fiveFeeders();
    // Rotate a known vertical case so sources arrive at the target's left port.
    const rotate = (point: RoutePoint) => ({ x: point.y, y: point.x });
    const edges: RoutingConnection[] = input.edges.map((edge) => ({
      ...edge,
      source: { ...rotate(edge.source), position: "right" },
      target: { ...rotate(edge.target), position: "left" },
    }));
    const obstacles = input.obstacles.map((rect) => ({
      id: rect.id,
      left: rect.top,
      right: rect.bottom,
      top: rect.left,
      bottom: rect.right,
    }));
    const routes = getConvergingRoutes({ edges, obstacles });
    assert.equal([...routes.values()].filter((route) => route.trunk).length, 1);
    for (const route of routes.values()) assertClear(route.points, obstacles);
  });
});

function assertClear(points: RoutePoint[], obstacles: RouteObstacle[]) {
  for (let index = 1; index < points.length; index += 1) {
    const first = points[index - 1];
    const second = points[index];
    assert.ok(first.x === second.x || first.y === second.y);
    for (const rect of obstacles) {
      const crosses =
        first.x === second.x
          ? first.x > rect.left &&
            first.x < rect.right &&
            Math.max(first.y, second.y) > rect.top &&
            Math.min(first.y, second.y) < rect.bottom
          : first.y > rect.top &&
            first.y < rect.bottom &&
            Math.max(first.x, second.x) > rect.left &&
            Math.min(first.x, second.x) < rect.right;
      assert.equal(
        crosses,
        false,
        `Crosses ${rect.id}: ${JSON.stringify({ first, second })}`,
      );
    }
  }
}
function onPolyline(point: RoutePoint, points: RoutePoint[]) {
  return points
    .slice(1)
    .some(
      (next, index) =>
        point.x >= Math.min(points[index].x, next.x) &&
        point.x <= Math.max(points[index].x, next.x) &&
        point.y >= Math.min(points[index].y, next.y) &&
        point.y <= Math.max(points[index].y, next.y),
    );
}
