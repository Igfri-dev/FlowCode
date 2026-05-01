import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySmartFlowLayout,
  type AutoLayoutEdge,
  type AutoLayoutNode,
} from "@/features/flow/auto-layout";
import {
  findDecisionHandleConflicts,
  findNodeOverlaps,
  getNodeBounds,
} from "@/features/flow/layout-quality";
import { flowStabilityFixtures } from "@/features/flow/fixtures/stability-fixtures";
import { importJavaScriptToFlow } from "@/features/flow/parser";
import type { FlowNodeConfig, FlowNodeType } from "@/types/flow";

describe("Smart flow auto-layout", () => {
  it("does not overlap blocks after layout", () => {
    const diagram = applySmartFlowLayout(createDiamondDiagram());

    assertNoOverlaps(diagram.nodes);
  });

  it("keeps a short linear sequence reasonably aligned in a column", () => {
    const diagram = applySmartFlowLayout(createLinearDiagram(3));
    const nodesInOrder = ["start", "step-0", "step-1", "step-2", "end"].map(
      (id) => getNode(diagram.nodes, id),
    );
    const centerXs = nodesInOrder.map((node) => centerX(node));

    assertNoOverlaps(diagram.nodes);
    assert.ok(Math.max(...centerXs) - Math.min(...centerXs) < 48);

    for (let index = 1; index < nodesInOrder.length; index += 1) {
      assert.ok(nodesInOrder[index - 1].position.y < nodesInOrder[index].position.y);
    }
  });

  it("keeps a long linear sequence compact without overlaps", () => {
    const diagram = applySmartFlowLayout(createLinearDiagram(12));

    assertNoOverlaps(diagram.nodes);
    assert.ok(totalHeight(diagram.nodes) < diagram.nodes.length * 180);
  });

  it("keeps decision yes/no handles visually distinct", () => {
    const diagram = applySmartFlowLayout(createDiamondDiagram());

    assert.deepEqual(findDecisionHandleConflicts(diagram.nodes), []);
  });

  it("places loop body and exit as legible separate branches", () => {
    const diagram = applySmartFlowLayout(createWhileDiagram());
    const body = getNode(diagram.nodes, "body");
    const exit = getNode(diagram.nodes, "end");

    assertNoOverlaps(diagram.nodes);
    assert.deepEqual(findDecisionHandleConflicts(diagram.nodes), []);
    assert.ok(distanceBetweenCenters(body, exit) > 180);
  });

  it("keeps switch cases separated", () => {
    const fixture = flowStabilityFixtures.find(
      (item) => item.id === "switch-branches",
    );

    assert.ok(fixture);

    const result = importJavaScriptToFlow(fixture.code);

    assert.equal(result.ok, true, result.ok ? "" : result.message);

    const caseOutputs = result.nodes.filter(
      (node) =>
        node.type === "output" &&
        ["Mostrar suma", "Mostrar resta", "Mostrar otro"].includes(
          node.data.label,
        ),
    );

    assert.equal(caseOutputs.length, 3);
    assertNoOverlaps(result.nodes);
    assert.ok(minimumCenterDistance(caseOutputs) > 120);
  });

  it("places unreachable nodes outside the main flow", () => {
    const diagram = applySmartFlowLayout({
      nodes: [
        createNode("start", "start"),
        createNode("step", "process", { instruction: "x = 1" }),
        createNode("end", "end"),
        createNode("orphan", "process", { instruction: "y = 2" }),
      ],
      edges: [
        createEdge("start", "step"),
        createEdge("step", "end"),
      ],
    });
    const mainNodes = ["start", "step", "end"].map((id) =>
      getNode(diagram.nodes, id),
    );
    const mainBounds = getGroupBounds(mainNodes);
    const orphanBounds = getNodeBounds(getNode(diagram.nodes, "orphan"));

    assertNoOverlaps(diagram.nodes);
    assert.ok(
      orphanBounds.left > mainBounds.right || orphanBounds.top > mainBounds.bottom,
    );
  });
});

function createLinearDiagram(processCount: number) {
  const processNodes = Array.from({ length: processCount }, (_, index) =>
    createNode(`step-${index}`, "process", {
      instruction: `x = x + ${index + 1}`,
    }),
  );
  const nodes = [
    createNode("start", "start"),
    ...processNodes,
    createNode("end", "end"),
  ];
  const edges = nodes
    .slice(0, -1)
    .map((node, index) => createEdge(node.id, nodes[index + 1].id));

  return {
    nodes,
    edges,
  };
}

function createDiamondDiagram() {
  return {
    nodes: [
      createNode("start", "start"),
      createNode("decision", "decision", { condition: "x > 0" }),
      createNode("yes", "output", {
        expression: '"positivo"',
        outputMode: "expression",
      }),
      createNode("no", "output", {
        expression: '"no positivo"',
        outputMode: "expression",
      }),
      createNode("end", "end"),
    ],
    edges: [
      createEdge("start", "decision"),
      createEdge("decision", "yes", "yes"),
      createEdge("decision", "no", "no"),
      createEdge("yes", "end"),
      createEdge("no", "end"),
    ],
  };
}

function createWhileDiagram() {
  return {
    nodes: [
      createNode("start", "start"),
      createNode("condition", "decision", { condition: "i < 3" }),
      createNode("body", "process", { instruction: "i++" }),
      createNode("end", "end"),
    ],
    edges: [
      createEdge("start", "condition"),
      createEdge("condition", "body", "yes"),
      createEdge("body", "condition"),
      createEdge("condition", "end", "no"),
    ],
  };
}

function createNode(
  id: string,
  type: FlowNodeType,
  config: FlowNodeConfig = {},
): AutoLayoutNode {
  return {
    id,
    type,
    position: {
      x: 0,
      y: 0,
    },
    data: {
      label: id,
      config,
    },
  } as AutoLayoutNode;
}

function createEdge(
  source: string,
  target: string,
  sourceHandle = "out",
): AutoLayoutEdge {
  return {
    source,
    sourceHandle,
    target,
    targetHandle: "in",
  };
}

function getNode(nodes: AutoLayoutNode[], id: string) {
  const node = nodes.find((item) => item.id === id);

  assert.ok(node, `Missing node ${id}`);

  return node;
}

function assertNoOverlaps(nodes: AutoLayoutNode[]) {
  assert.deepEqual(findNodeOverlaps(nodes), []);
}

function centerX(node: AutoLayoutNode) {
  const bounds = getNodeBounds(node);

  return (bounds.left + bounds.right) / 2;
}

function centerY(node: AutoLayoutNode) {
  const bounds = getNodeBounds(node);

  return (bounds.top + bounds.bottom) / 2;
}

function distanceBetweenCenters(first: AutoLayoutNode, second: AutoLayoutNode) {
  return Math.hypot(centerX(first) - centerX(second), centerY(first) - centerY(second));
}

function minimumCenterDistance(nodes: AutoLayoutNode[]) {
  let minDistance = Number.POSITIVE_INFINITY;

  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < nodes.length;
      rightIndex += 1
    ) {
      minDistance = Math.min(
        minDistance,
        distanceBetweenCenters(nodes[leftIndex], nodes[rightIndex]),
      );
    }
  }

  return minDistance;
}

function totalHeight(nodes: AutoLayoutNode[]) {
  const bounds = getGroupBounds(nodes);

  return bounds.bottom - bounds.top;
}

function getGroupBounds(nodes: AutoLayoutNode[]) {
  const bounds = nodes.map(getNodeBounds);

  return {
    bottom: Math.max(...bounds.map((item) => item.bottom)),
    left: Math.min(...bounds.map((item) => item.left)),
    right: Math.max(...bounds.map((item) => item.right)),
    top: Math.min(...bounds.map((item) => item.top)),
  };
}
