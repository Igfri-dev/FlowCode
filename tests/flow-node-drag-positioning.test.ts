import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NodeChange } from "@xyflow/react";
import {
  constrainFlowNodeChange,
  createFlowNodeDragSession,
} from "@/features/flow/node-drag-positioning";
import type { FlowEditorEdge, FlowEditorNode } from "@/types/flow";

describe("Flow node drag positioning", () => {
  it("snaps a vertical connection into a straight line when the handles are close", () => {
    const sourceNode = createNode({
      id: "source",
      position: { x: 100, y: 100 },
      type: "process",
      width: 100,
      height: 60,
    });
    const targetNode = createNode({
      id: "target",
      position: { x: 110, y: 220 },
      type: "process",
      width: 80,
      height: 60,
    });
    const change = createPositionChange("target", {
      x: 108,
      y: 220,
    });
    const constrainedChange = constrainFlowNodeChange({
      axisLock: null,
      change,
      dragSession: createFlowNodeDragSession([targetNode]),
      edges: [createEdge("source", "target")],
      nodes: [sourceNode, targetNode],
    });

    assert.equal(constrainedChange.type, "position");
    assert.deepEqual(constrainedChange.position, {
      x: 110,
      y: 220,
    });
  });

  it("snaps a horizontal connection into a straight line when the handles are close", () => {
    const sourceNode = createNode({
      id: "source",
      position: { x: 120, y: 80 },
      type: "process",
      width: 100,
      height: 60,
      handlePositions: {
        out: "right",
      },
    });
    const targetNode = createNode({
      id: "target",
      position: { x: 260, y: 90 },
      type: "process",
      width: 100,
      height: 60,
      handlePositions: {
        in: "left",
      },
    });
    const change = createPositionChange("target", {
      x: 260,
      y: 84,
    });
    const constrainedChange = constrainFlowNodeChange({
      axisLock: null,
      change,
      dragSession: createFlowNodeDragSession([targetNode]),
      edges: [createEdge("source", "target")],
      nodes: [sourceNode, targetNode],
    });

    assert.equal(constrainedChange.type, "position");
    assert.deepEqual(constrainedChange.position, {
      x: 260,
      y: 80,
    });
  });

  it("locks the x coordinate when the user activates the x-axis constraint", () => {
    const node = createNode({
      id: "node-1",
      position: { x: 160, y: 140 },
      type: "process",
      width: 100,
      height: 60,
    });
    const constrainedChange = constrainFlowNodeChange({
      axisLock: "fixX",
      change: createPositionChange("node-1", {
        x: 240,
        y: 300,
      }),
      dragSession: createFlowNodeDragSession([node]),
      edges: [],
      nodes: [node],
    });

    assert.equal(constrainedChange.type, "position");
    assert.deepEqual(constrainedChange.position, {
      x: 160,
      y: 300,
    });
  });

  it("does not auto-snap while dragging multiple selected nodes", () => {
    const sourceNode = createNode({
      id: "source",
      position: { x: 100, y: 100 },
      type: "process",
      width: 100,
      height: 60,
    });
    const targetNode = createNode({
      id: "target",
      position: { x: 110, y: 220 },
      type: "process",
      width: 80,
      height: 60,
    });
    const otherDraggedNode = createNode({
      id: "other",
      position: { x: 380, y: 220 },
      type: "process",
      width: 80,
      height: 60,
    });
    const constrainedChange = constrainFlowNodeChange({
      axisLock: null,
      change: createPositionChange("target", {
        x: 108,
        y: 220,
      }),
      dragSession: createFlowNodeDragSession([targetNode, otherDraggedNode]),
      edges: [createEdge("source", "target")],
      nodes: [sourceNode, targetNode, otherDraggedNode],
    });

    assert.equal(constrainedChange.type, "position");
    assert.deepEqual(constrainedChange.position, {
      x: 108,
      y: 220,
    });
  });
});

function createNode({
  height,
  id,
  position,
  type,
  width,
  handlePositions,
}: {
  height: number;
  id: string;
  position: {
    x: number;
    y: number;
  };
  type: FlowEditorNode["type"];
  width: number;
  handlePositions?: FlowEditorNode["data"]["handlePositions"];
}): FlowEditorNode {
  return {
    id,
    type,
    position,
    width,
    height,
    measured: {
      width,
      height,
    },
    data: {
      label: id,
      config: {},
      handlePositions,
      onLabelChange: () => {},
      onConfigChange: () => {},
      onHandlePositionsChange: () => {},
    },
  } as FlowEditorNode;
}

function createEdge(source: string, target: string): FlowEditorEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
    type: "flow",
  } as FlowEditorEdge;
}

function createPositionChange(
  id: string,
  position: {
    x: number;
    y: number;
  },
): NodeChange<FlowEditorNode> {
  return {
    id,
    type: "position",
    dragging: true,
    position,
    positionAbsolute: position,
  };
}
