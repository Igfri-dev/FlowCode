import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getOrthogonalRoute,
  type OrthogonalRoute,
  type RouteObstacle,
} from "@/components/editor/edges/orthogonal-routing";
import type { FlowHandlePosition } from "@/types/flow";

const source: RouteObstacle = {
  id: "source",
  left: 0,
  right: 100,
  top: 0,
  bottom: 60,
};
const target: RouteObstacle = {
  id: "target",
  left: 0,
  right: 100,
  top: 300,
  bottom: 360,
};
const port = (x: number, y: number, position: FlowHandlePosition) => ({
  x,
  y,
  position,
});

describe("obstacle-aware orthogonal connectors", () => {
  it("keeps a clear forward connection straight and exactly attached to ports", () => {
    const route = getOrthogonalRoute({
      source: port(50, 60, "bottom"),
      target: port(50, 300, "top"),
      sourceId: source.id,
      targetId: target.id,
      obstacles: [source, target],
    });
    assert.ok(route);
    assert.deepEqual(route.points, [
      { x: 50, y: 60 },
      { x: 50, y: 300 },
    ]);
    assert.equal(route.labelX, 50);
    assert.equal(route.labelY, 180);
  });

  it("routes around a block between vertically aligned ports", () => {
    const middle = {
      id: "middle",
      left: -30,
      right: 130,
      top: 130,
      bottom: 220,
    };
    const route = getOrthogonalRoute({
      source: port(50, 60, "bottom"),
      target: port(50, 300, "top"),
      sourceId: source.id,
      targetId: target.id,
      obstacles: [source, target, middle],
    });
    assert.ok(route);
    assertClear(route, [source, target, middle]);
    assert.ok(route.points.some((point) => point.x <= -48 || point.x >= 148));
    assertDeparture(route, "bottom", "top");
  });

  it("keeps opposing ports straight even when the gap is shorter than two stubs", () => {
    const closeTarget = { ...target, top: 85, bottom: 145 };
    const route = getOrthogonalRoute({
      source: port(50, 60, "bottom"),
      target: port(50, 85, "top"),
      sourceId: source.id,
      targetId: target.id,
      obstacles: [source, closeTarget],
    });
    assert.ok(route);
    assert.deepEqual(route.points, [
      { x: 50, y: 60 },
      { x: 50, y: 85 },
    ]);
  });

  it("places a backward loop around the source and target instead of through them", () => {
    const route = getOrthogonalRoute({
      source: port(50, 360, "bottom"),
      target: port(50, 0, "top"),
      sourceId: target.id,
      targetId: source.id,
      obstacles: [source, target],
    });
    assert.ok(route);
    assertClear(route, [source, target]);
    assertDeparture(route, "bottom", "top");
    assert.ok(
      route.points.some(
        (point) => point.x < source.left || point.x > source.right,
      ),
    );
  });

  it("respects left and right ports even when their nodes are reversed", () => {
    const rightNode = {
      id: "right",
      left: 300,
      right: 400,
      top: 100,
      bottom: 180,
    };
    const route = getOrthogonalRoute({
      source: port(0, 30, "left"),
      target: port(400, 140, "right"),
      sourceId: source.id,
      targetId: rightNode.id,
      obstacles: [source, rightNode],
    });
    assert.ok(route);
    assertClear(route, [source, rightNode]);
    assertDeparture(route, "left", "right");
  });

  it("routes a self-loop outside the block", () => {
    const route = getOrthogonalRoute({
      source: port(100, 30, "right"),
      target: port(50, 0, "top"),
      sourceId: source.id,
      targetId: source.id,
      obstacles: [source],
    });
    assert.ok(route);
    assertClear(route, [source]);
    assertDeparture(route, "right", "top");
  });

  it("draws a visible loop for coincident ports instead of retracing a line", () => {
    const route = getOrthogonalRoute({
      source: port(100, 30, "right"),
      target: port(100, 30, "right"),
      sourceId: source.id,
      targetId: source.id,
      obstacles: [source],
    });
    assert.ok(route);
    assertClear(route, [source]);
    assertDeparture(route, "right", "right");
    assert.ok(new Set(route.points.map((point) => point.x)).size >= 3);
    assert.ok(new Set(route.points.map((point) => point.y)).size >= 2);
  });

  it("finds a multi-bend route through staggered obstacles", () => {
    const obstacles = [
      { id: "one", left: -80, right: 70, top: 90, bottom: 140 },
      { id: "two", left: 30, right: 200, top: 180, bottom: 230 },
      { id: "three", left: -130, right: 90, top: 250, bottom: 290 },
      source,
      { ...target, top: 400, bottom: 460 },
    ];
    const route = getOrthogonalRoute({
      source: port(50, 60, "bottom"),
      target: port(50, 400, "top"),
      sourceId: source.id,
      targetId: target.id,
      obstacles,
    });
    assert.ok(route);
    assertClear(route, obstacles);
    assertDeparture(route, "bottom", "top");
  });

  it("prefers a clear perimeter over crossing an existing connector when inexpensive", () => {
    const previous = [
      [
        { x: 20, y: 100 },
        { x: 80, y: 100 },
      ],
    ];
    const route = getOrthogonalRoute({
      source: port(50, 60, "bottom"),
      target: port(50, 300, "top"),
      sourceId: source.id,
      targetId: target.id,
      obstacles: [source, target],
      otherRoutes: previous,
    });
    assert.ok(route);
    assertClear(route, [source, target]);
    assert.ok(route.points.some((point) => point.x <= 20 || point.x >= 80));
  });

  it("rejects non-finite endpoints without generating an invalid SVG", () => {
    assert.equal(
      getOrthogonalRoute({
        source: port(NaN, 60, "bottom"),
        target: port(50, 300, "top"),
        sourceId: source.id,
        targetId: target.id,
        obstacles: [],
      }),
      null,
    );
  });

  it("routes a forty-block diagram in a practical time", () => {
    const obstacles = Array.from({ length: 40 }, (_, index) => ({
      id: `node-${index}`,
      left: (index % 4) * 300,
      right: (index % 4) * 300 + 180,
      top: Math.floor(index / 4) * 210,
      bottom: Math.floor(index / 4) * 210 + 90,
    }));
    const started = performance.now();
    for (let index = 0; index < obstacles.length - 4; index += 1) {
      const first = obstacles[index];
      const second = obstacles[index + 4];
      const route = getOrthogonalRoute({
        source: port((first.left + first.right) / 2, first.bottom, "bottom"),
        target: port((second.left + second.right) / 2, second.top, "top"),
        sourceId: first.id,
        targetId: second.id,
        obstacles,
      });
      assert.ok(route);
      assertClear(route, obstacles);
    }
    assert.ok(
      performance.now() - started < 1500,
      "Routing forty blocks should remain interactive",
    );
  });
});

function assertClear(route: OrthogonalRoute, obstacles: RouteObstacle[]) {
  for (let index = 1; index < route.points.length; index += 1) {
    const from = route.points[index - 1];
    const to = route.points[index];
    assert.ok(
      from.x === to.x || from.y === to.y,
      "Every segment must be orthogonal",
    );
    for (const rect of obstacles) {
      const crosses =
        from.x === to.x
          ? from.x > rect.left &&
            from.x < rect.right &&
            Math.max(from.y, to.y) > rect.top &&
            Math.min(from.y, to.y) < rect.bottom
          : from.y > rect.top &&
            from.y < rect.bottom &&
            Math.max(from.x, to.x) > rect.left &&
            Math.min(from.x, to.x) < rect.right;
      assert.equal(
        crosses,
        false,
        `Route crosses ${rect.id}: ${JSON.stringify({ from, to })}`,
      );
    }
  }
  assert.ok(!route.path.includes("NaN"));
}
function assertDeparture(
  route: OrthogonalRoute,
  sourceSide: FlowHandlePosition,
  targetSide: FlowHandlePosition,
) {
  const first = route.points[0];
  const second = route.points[1];
  const last = route.points[route.points.length - 1];
  const previous = route.points[route.points.length - 2];
  const movesOut = (
    from: typeof first,
    to: typeof first,
    side: FlowHandlePosition,
  ) =>
    side === "top"
      ? to.y < from.y && to.x === from.x
      : side === "bottom"
        ? to.y > from.y && to.x === from.x
        : side === "left"
          ? to.x < from.x && to.y === from.y
          : to.x > from.x && to.y === from.y;
  assert.ok(
    movesOut(first, second, sourceSide),
    "Must leave along source port normal",
  );
  assert.ok(
    movesOut(last, previous, targetSide),
    "Must arrive along target port normal",
  );
}
