import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getConvergingRoutes } from "@/components/editor/edges/converging-routing";
import type {
  RoutePoint,
  RouteObstacle,
} from "@/components/editor/edges/orthogonal-routing";
import { applySmartFlowLayout } from "@/features/flow/auto-layout";
import { getNodeBounds } from "@/features/flow/layout-quality";
import { importJavaScriptToFlow } from "@/features/flow/parser";
import type { FlowNodeHandleId } from "@/types/flow";

type Example = {
  name: string;
  code: string;
  measuredByDiagram: Record<
    string,
    Record<string, { width: number; height: number }>
  >;
};
type Connection = Parameters<typeof getConvergingRoutes>[0]["edges"][number];
const examples = JSON.parse(
  readFileSync(
    new URL("./fixtures/import-layout-examples.json", import.meta.url),
    "utf8",
  ),
) as Example[];

function arrange(
  code: string,
  measurements: Example["measuredByDiagram"] = {},
) {
  const imported = importJavaScriptToFlow(code);
  assert.ok(imported.ok, imported.ok ? "" : imported.message);
  return [
    { name: "main", nodes: imported.nodes, edges: imported.edges },
    ...imported.functions,
  ].map((diagram) => {
    const layout = applySmartFlowLayout({
      nodes: diagram.nodes.map((node) => ({
        ...node,
        measured: measurements[diagram.name]?.[node.id],
      })),
      edges: diagram.edges,
    });
    const obstacles = layout.nodes.map((node) => ({
      id: node.id,
      ...getNodeBounds(node),
    }));
    const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
    function port(id: string, handle: FlowNodeHandleId) {
      const node = nodeById.get(id)!;
      const bounds = getNodeBounds(node);
      const position = node.data.handlePositions![handle]!;
      assert.ok(position, `Missing ${id}/${handle}`);
      return {
        position,
        x:
          position === "left"
            ? bounds.left
            : position === "right"
              ? bounds.right
              : (bounds.left + bounds.right) / 2,
        y:
          position === "top"
            ? bounds.top
            : position === "bottom"
              ? bounds.bottom
              : (bounds.top + bounds.bottom) / 2,
      };
    }
    const edges: Connection[] = diagram.edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      source: port(
        edge.source,
        (edge.sourceHandle ?? "out") as FlowNodeHandleId,
      ),
      target: port(
        edge.target,
        (edge.targetHandle ?? "in") as FlowNodeHandleId,
      ),
    }));
    return { name: diagram.name, edges, obstacles };
  });
}

describe("Routing of the hand-arranged reference programs", () => {
  for (const example of examples) {
    it(`keeps full connections and shared paths outside blocks in ${example.name}`, () => {
      for (const diagram of arrange(example.code, example.measuredByDiagram)) {
        assertDiagramRoutes(diagram, `${example.name}/${diagram.name}`);
      }
    });
  }

  for (const [name, code] of [
    [
      "if/else",
      `let numero = 8;
      if (numero % 2 === 0) { console.log("El numero es par"); }
      else { console.log("El numero es impar"); }
      console.log("Terminado");`,
    ],
    [
      "switch",
      `let operacion = "multiplicar"; let a = 12; let b = 4;
      switch (operacion) {
        case "sumar": console.log(a + b); break;
        case "restar": console.log(a - b); break;
        case "multiplicar": console.log(a * b); break;
        case "dividir": console.log(a / b); break;
        default: console.log("Operacion no valida");
      }`,
    ],
  ]) {
    it(`merges the converging ${name} connections into one owned trunk`, () => {
      const [diagram] = arrange(code);
      const routes = assertDiagramRoutes(diagram, name);
      const groups = new Map<string, Connection[]>();
      for (const edge of diagram.edges) {
        const key = `${edge.targetId}:${edge.target.position}:${edge.target.x}:${edge.target.y}`;
        const group = groups.get(key) ?? [];
        group.push(edge);
        groups.set(key, group);
      }
      let mergedGroupCount = 0;
      for (const group of groups.values()) {
        const owners = group.filter((edge) => routes.get(edge.id)?.trunk);
        if (owners.length === 0) continue;
        assert.equal(
          owners.length,
          1,
          `${name}: shared path has multiple owners`,
        );
        assert.ok(
          group.length > 1,
          `${name}: trunk without converging connections`,
        );
        const trunk = routes.get(owners[0].id)!.trunk!;
        assertSamePoint(
          trunk.points[trunk.points.length - 1],
          group[0].target,
          `${name}: trunk endpoint`,
        );
        for (const edge of group) {
          const branch = routes.get(edge.id)?.branch;
          assert.ok(branch, `${name}: missing branch for ${edge.id}`);
          assertSamePoint(
            branch.points[0],
            edge.source,
            `${name}: branch source`,
          );
          const junction = branch.points[branch.points.length - 1];
          assert.ok(
            trunk.points
              .slice(1)
              .some((point, index) =>
                pointOnSegment(junction, trunk.points[index], point),
              ),
            `${name}: branch does not meet its shared trunk`,
          );
        }
        mergedGroupCount += 1;
      }
      assert.ok(mergedGroupCount > 0, `${name}: no shared trunk was generated`);
    });
  }
});

function assertDiagramRoutes(
  diagram: { edges: Connection[]; obstacles: RouteObstacle[] },
  context: string,
) {
  const routes = getConvergingRoutes(diagram);
  for (const edge of diagram.edges) {
    const route = routes.get(edge.id);
    const edgeContext = `${context}/${edge.sourceId}->${edge.targetId}`;
    assert.ok(route, `${edgeContext}: no obstacle-free route`);
    assertSamePoint(
      route.points[0],
      edge.source,
      `${edgeContext}: source changed`,
    );
    assertSamePoint(
      route.points[route.points.length - 1],
      edge.target,
      `${edgeContext}: target changed`,
    );
    assertObstacleFree(route.points, diagram.obstacles, `${edgeContext}/full`);
    if (route.branch)
      assertObstacleFree(
        route.branch.points,
        diagram.obstacles,
        `${edgeContext}/branch`,
      );
    if (route.trunk)
      assertObstacleFree(
        route.trunk.points,
        diagram.obstacles,
        `${edgeContext}/trunk`,
      );
  }
  return routes;
}

function assertSamePoint(
  actual: RoutePoint,
  expected: RoutePoint,
  context: string,
) {
  assert.ok(
    Math.abs(actual.x - expected.x) < 0.001 &&
      Math.abs(actual.y - expected.y) < 0.001,
    context,
  );
}

function pointOnSegment(
  point: RoutePoint,
  first: RoutePoint,
  second: RoutePoint,
) {
  return (
    (Math.abs(first.x - second.x) < 0.001
      ? Math.abs(point.x - first.x) < 0.001
      : Math.abs(point.y - first.y) < 0.001) &&
    point.x >= Math.min(first.x, second.x) - 0.001 &&
    point.x <= Math.max(first.x, second.x) + 0.001 &&
    point.y >= Math.min(first.y, second.y) - 0.001 &&
    point.y <= Math.max(first.y, second.y) + 0.001
  );
}

function assertObstacleFree(
  points: RoutePoint[],
  obstacles: RouteObstacle[],
  context: string,
) {
  for (let i = 1; i < points.length; i++) {
    const first: RoutePoint = points[i - 1];
    const second: RoutePoint = points[i];
    assert.ok(
      first.x === second.x || first.y === second.y,
      `${context}: diagonal segment`,
    );
    for (const obstacle of obstacles) {
      const intersects: boolean =
        first.x === second.x
          ? first.x > obstacle.left + 0.001 &&
            first.x < obstacle.right - 0.001 &&
            Math.max(first.y, second.y) > obstacle.top + 0.001 &&
            Math.min(first.y, second.y) < obstacle.bottom - 0.001
          : first.y > obstacle.top + 0.001 &&
            first.y < obstacle.bottom - 0.001 &&
            Math.max(first.x, second.x) > obstacle.left + 0.001 &&
            Math.min(first.x, second.x) < obstacle.right - 0.001;
      assert.equal(intersects, false, `${context}: crosses ${obstacle.id}`);
    }
  }
}
