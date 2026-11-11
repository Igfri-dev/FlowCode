import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ImportedFlowNode } from "@/features/flow/parser";
import {
  createWorkspaceHistory,
  createWorkspaceSnapshot,
  getWorkspaceSignature,
  parseWorkspaceSnapshot,
  recordWorkspaceHistory,
  redoWorkspaceHistory,
  undoWorkspaceHistory,
} from "@/features/flow/components/workspace/flowWorkspaceHistory";
import type { FlowEditorNode, FlowProgram } from "@/types/flow";

describe("Flow workspace persistence and history", () => {
  it("roundtrips nodes, functions, parameters, configuration and positions", () => {
    const program = createProgram();
    program.functions.push({
      id: "function-1",
      name: "double",
      parameters: ["value"],
      parameterDefinitions: [
        { name: "value", source: "value = 2", defaultValue: "2" },
      ],
      nodes: program.main.nodes,
      edges: [],
    });
    const snapshot = createWorkspaceSnapshot(
      program,
      "exercise-1",
      "function-1",
    );
    const parsed = parseWorkspaceSnapshot(
      JSON.stringify(snapshot),
      createEditorNode,
    );

    assert.ok(parsed);
    assert.equal(
      getWorkspaceSignature(parsed.snapshot),
      getWorkspaceSignature(snapshot),
    );
    assert.equal(parsed.snapshot.activeDiagramId, "function-1");
    assert.equal(parsed.snapshot.exerciseId, "exercise-1");
    assert.deepEqual(parsed.program.main.nodes[0].position, { x: 12, y: 34 });
    assert.deepEqual(parsed.program.main.nodes[0].data.config, {
      instruction: "x = 1",
    });
    assert.deepEqual(
      JSON.parse(
        JSON.stringify(parsed.program.functions[0].parameterDefinitions),
      ),
      program.functions[0].parameterDefinitions,
    );
    assert.equal(
      typeof parsed.program.main.nodes[0].data.onConfigChange,
      "function",
    );
  });

  it("ignores callbacks, execution, selection, measurements and active diagram", () => {
    const program = createProgram();
    const original = createWorkspaceSnapshot(program, null, "main");
    program.main.nodes[0] = {
      ...program.main.nodes[0],
      selected: true,
      dragging: true,
      measured: { width: 200, height: 150 },
      width: 200,
      height: 150,
      data: {
        ...program.main.nodes[0].data,
        onConfigChange: () => {
          throw new Error("never serialized");
        },
        execution: { isCurrent: true, isVisited: true },
        handlePositions: { in: "top", out: "bottom" },
      },
    };
    program.main.edges[0].selected = true;
    program.main.edges[0].animated = true;
    program.main.edges[0].style = { stroke: "red" };
    const changed = createWorkspaceSnapshot(program, null, "main");
    changed.activeDiagramId = "another-view";

    assert.equal(
      getWorkspaceSignature(changed),
      getWorkspaceSignature(original),
    );
    assert.ok(!JSON.stringify(changed).includes("execution"));
    assert.ok(!JSON.stringify(changed).includes("selected"));
  });

  it("captures edits to node configuration, position, ports and connections", () => {
    const original = createWorkspaceSnapshot(createProgram(), null, "main");
    const changes = [
      (program: FlowProgram) => {
        program.main.nodes[0].data.config = { instruction: "x = 2" };
      },
      (program: FlowProgram) => {
        program.main.nodes[0].position.x += 10;
      },
      (program: FlowProgram) => {
        program.main.nodes[0].data.handlePositions = { out: "left" };
      },
      (program: FlowProgram) => {
        program.main.edges[0].sourceHandle = "another-port";
      },
    ];
    for (const change of changes) {
      const program = createProgram();
      change(program);
      assert.notEqual(
        getWorkspaceSignature(createWorkspaceSnapshot(program, null, "main")),
        getWorkspaceSignature(original),
      );
    }
  });

  it("returns null for invalid JSON or malformed snapshot schemas", () => {
    for (const text of [
      "{",
      "null",
      "[]",
      "{}",
      JSON.stringify({
        program: {},
        exerciseId: null,
        activeDiagramId: "main",
      }),
      JSON.stringify({
        program: { main: { nodes: [null], edges: [] }, functions: [] },
        exerciseId: null,
        activeDiagramId: "main",
      }),
    ]) {
      assert.equal(parseWorkspaceSnapshot(text, createEditorNode), null);
    }
  });

  it("keeps snapshots independent of later mutable edits", () => {
    const program = createProgram();
    const snapshot = createWorkspaceSnapshot(program, null, "main");
    program.main.nodes[0].data.config = { instruction: "x = 9" };
    program.main.nodes[0].position.x = 999;
    assert.deepEqual(snapshot.program.main.nodes[0].data.config, {
      instruction: "x = 1",
    });
    assert.equal(snapshot.program.main.nodes[0].position.x, 12);
  });

  it("coalesces edits, supports undo/redo and clears redo on a divergent edit", () => {
    const initial = snapshotAt(0);
    let history = createWorkspaceHistory(initial);
    history = recordWorkspaceHistory(history, snapshotAt(1));
    history = recordWorkspaceHistory(history, snapshotAt(2), true);
    assert.equal(history.past.length, 1);
    history = undoWorkspaceHistory(history);
    assert.deepEqual(history.present, initial);
    history = redoWorkspaceHistory(history);
    assert.equal(history.present.program.main.nodes[0].position.x, 2);
    history = undoWorkspaceHistory(history);
    history = recordWorkspaceHistory(history, snapshotAt(3));
    assert.equal(history.future.length, 0);
    assert.strictEqual(redoWorkspaceHistory(history), history);
  });

  it("does not create undo entries or discard redo for view-only changes", () => {
    let history = createWorkspaceHistory(snapshotAt(0));
    assert.strictEqual(undoWorkspaceHistory(history), history);
    history = recordWorkspaceHistory(history, snapshotAt(1));
    history = undoWorkspaceHistory(history);
    history = recordWorkspaceHistory(history, {
      ...history.present,
      activeDiagramId: "another-view",
    });
    assert.equal(history.past.length, 0);
    assert.equal(history.future.length, 1);
    assert.equal(history.present.activeDiagramId, "another-view");
  });

  it("retains at most 60 undo entries", () => {
    let history = createWorkspaceHistory(snapshotAt(0));
    for (let index = 1; index <= 80; index += 1) {
      history = recordWorkspaceHistory(history, snapshotAt(index));
    }
    assert.equal(history.past.length, 60);
    assert.equal(history.past[0].program.main.nodes[0].position.x, 20);
  });
});

function snapshotAt(x: number) {
  const program = createProgram();
  program.main.nodes[0].position.x = x;
  return createWorkspaceSnapshot(program, null, "main");
}

function createProgram(): FlowProgram {
  return {
    main: {
      nodes: [
        createEditorNode({
          id: "process-1",
          type: "process",
          position: { x: 12, y: 34 },
          data: { label: "Set x", config: { instruction: "x = 1" } },
        }),
      ],
      edges: [
        {
          id: "edge-1",
          source: "process-1",
          target: "process-1",
          type: "flow",
        },
      ],
    },
    functions: [],
  };
}

function createEditorNode(node: ImportedFlowNode): FlowEditorNode {
  return {
    ...node,
    data: {
      ...node.data,
      onLabelChange: () => undefined,
      onConfigChange: () => undefined,
      onHandlePositionsChange: () => undefined,
    },
  };
}
