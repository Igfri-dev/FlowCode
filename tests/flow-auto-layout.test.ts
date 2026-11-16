import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySmartFlowLayout,
  autoLayoutMinimumBlockGap,
  getAutoLayoutNodeSize,
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
  const downwardOutputExamples = [
    {
      name: "even/odd branches",
      code: `async function main() {
        let numero = 8;
        if (numero % 2 === 0) {
          console.log("El numero es par");
        } else {
          console.log("El numero es impar");
        }
      }
      main();`,
      outputCount: 2,
    },
    {
      name: "nested positive/negative/zero branches",
      code: `async function leerEntrada(mensaje, tipo = "text") {
        const valor = prompt(mensaje);
        if (tipo === "number") return Number(valor);
        if (tipo === "boolean") return valor === "true" || valor === "si";
        return valor ?? "";
      }
      async function main() {
        let numero = await leerEntrada("Ingresa un numero", "number");
        if (numero > 0) {
          console.log("Positivo");
        } else {
          if (numero < 0) {
            console.log("Negativo");
          } else {
            console.log("Cero");
          }
        }
      }
      main();`,
      outputCount: 3,
    },
  ];

  for (const example of downwardOutputExamples) {
    for (const measured of [false, true]) {
      it(`uses top output inputs for ${example.name} with ${measured ? "measured" : "estimated"} sizes`, () => {
        const result = importJavaScriptToFlow(example.code);
        assert.equal(result.ok, true, result.ok ? "" : result.message);
        const diagram = measured
          ? applySmartFlowLayout({
              edges: result.edges,
              nodes: result.nodes.map((node) => ({
                ...node,
                measured:
                  node.type === "output"
                    ? { width: 520, height: 210 }
                    : getAutoLayoutNodeSize(node),
              })),
            })
          : result;
        const outputs = diagram.nodes.filter((node) => node.type === "output");
        assert.equal(outputs.length, example.outputCount);
        for (const output of outputs) {
          assert.equal(output.data.handlePositions?.in, "top");
          const incoming = diagram.edges.find(
            (edge) => edge.target === output.id,
          );
          assert.ok(incoming);
          assert.ok(
            getNodeBounds(getNode(diagram.nodes, incoming.source)).bottom <
              getNodeBounds(output).top,
          );
        }
        assertNoOverlaps(diagram.nodes);
        assert.deepEqual(diagram.edges, result.edges);
      });
    }
  }

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
      assert.ok(
        nodesInOrder[index - 1].position.y < nodesInOrder[index].position.y,
      );
    }
  });

  it("keeps a long linear sequence compact without overlaps", () => {
    const diagram = applySmartFlowLayout(createLinearDiagram(12));

    assertNoOverlaps(diagram.nodes);
    assert.ok(totalHeight(diagram.nodes) < diagram.nodes.length * 180);
    const centerXs = diagram.nodes.map(centerX);
    assert.ok(Math.max(...centerXs) - Math.min(...centerXs) < 1);
    for (let index = 1; index < diagram.nodes.length; index += 1) {
      assert.ok(
        diagram.nodes[index].position.y > diagram.nodes[index - 1].position.y,
      );
    }
  });

  it("reserves complete nested branches before placing their shared continuation", () => {
    const result = importJavaScriptToFlow(`
      let result = 0;
      if (a) {
        if (b) { result = 1; } else { result = 2; }
      } else {
        if (c) { result = 3; } else { result = 4; }
      }
      console.log(result);
    `);
    assert.equal(result.ok, true, result.ok ? "" : result.message);
    assertNoOverlaps(result.nodes);
    const continuation = result.nodes.find((node) => node.type === "output");
    assert.ok(continuation);
    const branches = result.nodes.filter(
      (node) =>
        node.type === "process" &&
        "instruction" in node.data.config &&
        /^result = [1-4]$/.test(node.data.config.instruction),
    );
    assert.equal(branches.length, 4);
    for (const branch of branches) {
      assert.ok(getNodeBounds(continuation).top > getNodeBounds(branch).bottom);
    }
    assert.equal(continuation.data.handlePositions?.in, "top");
  });

  it("keeps a join input stable when incoming edges are reordered", () => {
    const original = createDiamondDiagram();
    const join = createNode("join", "process", { instruction: "x = 1" });
    const nodes = [
      ...original.nodes.filter((node) => node.type !== "end"),
      join,
      createNode("end", "end"),
    ];
    const edges = original.edges.map((edge) =>
      edge.target === "end" ? { ...edge, target: "join" } : edge,
    );
    edges.push(createEdge("join", "end"));
    const forward = applySmartFlowLayout({ nodes, edges });
    const reversed = applySmartFlowLayout({
      nodes,
      edges: [...edges].reverse(),
    });
    assert.equal(
      getNode(forward.nodes, "join").data.handlePositions?.in,
      "top",
    );
    assert.deepEqual(
      getNode(forward.nodes, "join").data.handlePositions,
      getNode(reversed.nodes, "join").data.handlePositions,
    );
  });

  it("places a for-loop update below its body and leaves a return lane", () => {
    const result = importJavaScriptToFlow(
      "for (let i = 0; i < 5; i++) { console.log(i); }",
    );
    assert.equal(result.ok, true, result.ok ? "" : result.message);
    const body = result.nodes.find((node) => node.type === "output");
    const update = result.nodes.find(
      (node) =>
        node.type === "process" &&
        "instruction" in node.data.config &&
        node.data.config.instruction === "i++",
    );
    assert.ok(body);
    assert.ok(update);
    assert.ok(getNodeBounds(update).top > getNodeBounds(body).bottom);
    assert.equal(update.data.handlePositions?.in, "top");
    assert.equal(update.data.handlePositions?.out, "left");
    assertNoOverlaps(result.nodes);
  });

  it("places a do-while condition after the complete body", () => {
    const result = importJavaScriptToFlow(
      "let i = 0; do { console.log(i); i++; } while (i < 5);",
    );
    assert.equal(result.ok, true, result.ok ? "" : result.message);
    const condition = result.nodes.find((node) => node.type === "decision");
    const body = result.nodes.find((node) => node.type === "output");
    assert.ok(condition);
    assert.ok(body);
    assert.ok(getNodeBounds(condition).top > getNodeBounds(body).bottom);
    assert.equal(condition.data.handlePositions?.yes, "left");
    assert.equal(condition.data.handlePositions?.no, "bottom");
  });

  it("keeps straight switch case bodies horizontal with space for measured widths", () => {
    const result = importJavaScriptToFlow(
      'switch (x) { case 1: console.log("one"); break; default: console.log("other"); }',
    );
    assert.equal(result.ok, true, result.ok ? "" : result.message);
    const diagram = applySmartFlowLayout({
      edges: result.edges,
      nodes: result.nodes.map((node) => ({
        ...node,
        measured: { width: node.type === "output" ? 520 : 200, height: 150 },
      })),
    });
    const output = diagram.nodes.find(
      (node) =>
        node.type === "output" &&
        "expression" in node.data.config &&
        node.data.config.expression === "one",
    );
    const breakNode = diagram.nodes.find(
      (node) =>
        node.type === "process" &&
        "instruction" in node.data.config &&
        node.data.config.instruction === "break",
    );
    assert.ok(output);
    assert.ok(breakNode);
    assert.equal(centerY(output), centerY(breakNode));
    assert.ok(
      getNodeBounds(breakNode).left - getNodeBounds(output).right >=
        autoLayoutMinimumBlockGap,
    );
    assert.equal(output.data.handlePositions?.out, "right");
    assert.equal(breakNode.data.handlePositions?.in, "left");
    assertNoOverlaps(diagram.nodes);
  });

  it("estimates wrapped process heights and honors partial live measurements", () => {
    const short = createNode("short", "process", { instruction: "x = 1" });
    const long = createNode("long", "process", {
      instruction:
        "const nombreLimpio = usuario.nombre.trim();\nconst nivel = usuario.perfil?.nivel ?? 1;",
    });
    assert.ok(
      getAutoLayoutNodeSize(long).height > getAutoLayoutNodeSize(short).height,
    );
    assert.equal(
      getAutoLayoutNodeSize({ ...long, measured: { width: 480 } }).width,
      480,
    );
    assert.equal(
      getAutoLayoutNodeSize({ ...long, measured: { height: 600 } }).height,
      600,
    );
    const diagram = applySmartFlowLayout({
      nodes: [short, long, createNode("end", "end")],
      edges: [createEdge("short", "long"), createEdge("long", "end")],
    });
    assertNoOverlaps(diagram.nodes);
    assert.ok(
      getNodeBounds(getNode(diagram.nodes, "end")).top >
        getNodeBounds(getNode(diagram.nodes, "long")).bottom,
    );
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
      edges: [createEdge("start", "step"), createEdge("step", "end")],
    });
    const mainNodes = ["start", "step", "end"].map((id) =>
      getNode(diagram.nodes, id),
    );
    const mainBounds = getGroupBounds(mainNodes);
    const orphanBounds = getNodeBounds(getNode(diagram.nodes, "orphan"));

    assertNoOverlaps(diagram.nodes);
    assert.ok(
      orphanBounds.left > mainBounds.right ||
        orphanBounds.top > mainBounds.bottom,
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
  return Math.hypot(
    centerX(first) - centerX(second),
    centerY(first) - centerY(second),
  );
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
