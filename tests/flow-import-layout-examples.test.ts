import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  applySmartFlowLayout,
  type AutoLayoutNode,
} from "@/features/flow/auto-layout";
import { generateJavaScriptFromFlow } from "@/features/flow/codegen";
import {
  findDecisionHandleConflicts,
  findNodeOverlaps,
} from "@/features/flow/layout-quality";
import {
  importJavaScriptToFlow,
  type ImportedFlowNode,
} from "@/features/flow/parser";
import type {
  FlowEditorEdge,
  FlowEditorNode,
  FlowFunctionDefinition,
} from "@/types/flow";

type ImportLayoutExample = {
  name: string;
  code: string;
  measuredByDiagram: Record<
    string,
    Record<string, { width: number; height: number }>
  >;
};

type Diagram = {
  nodes: ImportedFlowNode[];
  edges: FlowEditorEdge[];
};

// Only source code and block measurements from the supplied examples are kept.
// Positions, manually routed connections and local filesystem paths are excluded.
const examples = JSON.parse(
  readFileSync(
    new URL("./fixtures/import-layout-examples.json", import.meta.url),
    "utf8",
  ),
) as ImportLayoutExample[];

describe("Imported example layouts", () => {
  for (const example of examples) {
    it(`places every diagram in ${example.name} without overlaps or port conflicts`, () => {
      const result = importJavaScriptToFlow(example.code);
      assert.equal(result.ok, true, result.ok ? "" : result.message);

      for (const diagram of [
        { name: "main", nodes: result.nodes, edges: result.edges },
        ...result.functions,
      ]) {
        assertReadableLayout(diagram.nodes, `${example.name}/${diagram.name}`);
      }
    });

    it(`preserves ${example.name} topology and generated code when using measured block sizes`, () => {
      const result = importJavaScriptToFlow(example.code);
      assert.equal(result.ok, true, result.ok ? "" : result.message);

      function relayout(diagram: Diagram, name: string) {
        const layout = applySmartFlowLayout({
          edges: diagram.edges,
          nodes: diagram.nodes.map((node, index) => ({
            ...node,
            // Imported positions must not influence placement or program logic.
            position: { x: -index * 41, y: index % 2 ? -500 : 500 },
            measured: example.measuredByDiagram[name]?.[node.id],
          })),
        });

        assertReadableLayout(layout.nodes, `${example.name}/${name}/measured`);
        assert.deepEqual(layout.edges, diagram.edges, "Layout changed connections");
        assert.deepEqual(
          semanticNodes(layout.nodes),
          semanticNodes(diagram.nodes),
          "Layout changed blocks or control-flow metadata",
        );

        return layout;
      }

      const main = relayout(result, "main");
      const functions = result.functions.map((flowFunction) => ({
        ...flowFunction,
        ...relayout(flowFunction, flowFunction.name),
      }));
      const originalCode = generateJavaScriptFromFlow({
        nodes: result.nodes as FlowEditorNode[],
        edges: result.edges,
        functions: result.functions as unknown as FlowFunctionDefinition[],
      });
      const measuredCode = generateJavaScriptFromFlow({
        nodes: main.nodes as FlowEditorNode[],
        edges: main.edges,
        functions: functions as unknown as FlowFunctionDefinition[],
      });

      assert.deepEqual(measuredCode, originalCode);
    });
  }
});

function semanticNodes(nodes: AutoLayoutNode[]) {
  return nodes.map(({ id, type, data }) => {
    const { handlePositions: _handlePositions, ...semanticData } = data;
    return { id, type, data: semanticData };
  });
}

function assertReadableLayout(nodes: AutoLayoutNode[], context: string) {
  assert.deepEqual(findNodeOverlaps(nodes), [], `${context}: overlapping blocks`);
  assert.deepEqual(
    findDecisionHandleConflicts(nodes),
    [],
    `${context}: decision outputs share a side`,
  );

  for (const node of nodes) {
    const handles = node.data.handlePositions;
    assert.ok(handles, `${context}/${node.id}: missing port positions`);
    if (handles.in && handles.out) {
      assert.notEqual(
        handles.in,
        handles.out,
        `${context}/${node.id}: input and output share a side`,
      );
    }
    assert.ok(Number.isFinite(node.position.x), `${context}: invalid x`);
    assert.ok(Number.isFinite(node.position.y), `${context}: invalid y`);
  }
}
