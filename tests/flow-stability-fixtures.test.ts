import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateJavaScriptFromFlow } from "@/features/flow/codegen";
import { flowStabilityFixtures } from "@/features/flow/fixtures/stability-fixtures";
import {
  analyzeFlowLayout,
  findDecisionHandleConflicts,
  findNodeOverlaps,
} from "@/features/flow/layout-quality";
import { importJavaScriptToFlow } from "@/features/flow/parser";
import type { AutoLayoutNode } from "@/features/flow/auto-layout";
import type { FlowEditorNode, FlowFunctionDefinition } from "@/types/flow";

describe("Flow stability fixtures", () => {
  for (const fixture of flowStabilityFixtures) {
    it(`keeps ${fixture.name} stable`, () => {
      const result = importJavaScriptToFlow(fixture.code);

      if (!fixture.expectations.importOk) {
        assert.equal(result.ok, false);
        assert.match(
          result.message,
          new RegExp(escapeRegExp(fixture.expectations.errorIncludes ?? "")),
        );
        return;
      }

      assert.equal(result.ok, true, result.ok ? "" : result.message);

      const diagrams = [
        {
          name: "main",
          nodes: result.nodes,
          edges: result.edges,
        },
        ...result.functions.map((flowFunction) => ({
          name: flowFunction.name,
          nodes: flowFunction.nodes,
          edges: flowFunction.edges,
        })),
      ];
      const allNodes = diagrams.flatMap((diagram) => diagram.nodes);
      const allEdges = diagrams.flatMap((diagram) => diagram.edges);

      if (fixture.expectations.minNodes !== undefined) {
        assert.ok(
          allNodes.length >= fixture.expectations.minNodes,
          `${fixture.id}: expected at least ${fixture.expectations.minNodes} nodes, got ${allNodes.length}`,
        );
      }

      if (fixture.expectations.minEdges !== undefined) {
        assert.ok(
          allEdges.length >= fixture.expectations.minEdges,
          `${fixture.id}: expected at least ${fixture.expectations.minEdges} edges, got ${allEdges.length}`,
        );
      }

      for (const expectedNodeType of fixture.expectations.nodeTypes ?? []) {
        assert.ok(
          allNodes.some((node) => node.type === expectedNodeType),
          `${fixture.id}: missing node type ${expectedNodeType}`,
        );
      }

      for (const diagram of diagrams) {
        const overlaps = findNodeOverlaps(diagram.nodes as AutoLayoutNode[]);
        const handleConflicts = findDecisionHandleConflicts(
          diagram.nodes as AutoLayoutNode[],
        );
        const quality = analyzeFlowLayout({
          nodes: diagram.nodes as AutoLayoutNode[],
          edges: diagram.edges,
        });

        assert.deepEqual(overlaps, [], `${fixture.id}/${diagram.name} overlaps`);
        assert.deepEqual(
          handleConflicts,
          [],
          `${fixture.id}/${diagram.name} handle conflicts`,
        );
        assert.equal(quality.nodeCount, diagram.nodes.length);
        assert.equal(quality.edgeCount, diagram.edges.length);
      }

      const generatedCode = generateJavaScriptFromFlow({
        nodes: result.nodes as FlowEditorNode[],
        edges: result.edges,
        functions: result.functions as unknown as FlowFunctionDefinition[],
      });

      for (const expectedCode of fixture.expectations.codeIncludes ?? []) {
        assert.ok(
          generatedCode.code.includes(expectedCode),
          `${fixture.id}: generated code did not include ${expectedCode}`,
        );
      }
    });
  }
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
