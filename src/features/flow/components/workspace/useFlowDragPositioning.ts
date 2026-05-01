import { useCallback, useEffect, useRef } from "react";
import {
  applyNodeChanges,
  type NodeChange,
  type OnNodeDrag,
  type useNodesState,
} from "@xyflow/react";
import {
  constrainFlowNodeChange,
  createFlowNodeDragSession,
  type FlowNodeDragAxisLock,
} from "@/features/flow/node-drag-positioning";
import type { FlowEditorEdge, FlowEditorNode } from "@/types/flow";

type DragAxisKey = "KeyX" | "KeyY";
type SetNodes = ReturnType<typeof useNodesState<FlowEditorNode>>[1];

export function useFlowDragPositioning({
  edges,
  setNodes,
}: {
  edges: FlowEditorEdge[];
  setNodes: SetNodes;
}) {
  const dragSessionRef = useRef<ReturnType<
    typeof createFlowNodeDragSession
  > | null>(null);
  const dragAxisLockRef = useRef<FlowNodeDragAxisLock | null>(null);
  const pressedDragAxisKeysRef = useRef<Set<DragAxisKey>>(new Set());
  const dragSessionClearFrameRef = useRef<number | null>(null);

  const clearScheduledDragSessionReset = useCallback(() => {
    if (dragSessionClearFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(dragSessionClearFrameRef.current);
    dragSessionClearFrameRef.current = null;
  }, []);

  useEffect(() => {
    const syncDragAxisLock = () => {
      dragAxisLockRef.current = getFlowNodeDragAxisLock(
        pressedDragAxisKeysRef.current,
      );
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isDragAxisKey(event.code) || isEditableKeyboardTarget(event.target)) {
        return;
      }

      pressedDragAxisKeysRef.current.add(event.code);
      syncDragAxisLock();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isDragAxisKey(event.code)) {
        return;
      }

      pressedDragAxisKeysRef.current.delete(event.code);
      syncDragAxisLock();
    };
    const handleWindowBlur = () => {
      pressedDragAxisKeysRef.current.clear();
      dragAxisLockRef.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  useEffect(
    () => () => {
      clearScheduledDragSessionReset();
    },
    [clearScheduledDragSessionReset],
  );

  const handleNodeDragStart = useCallback<OnNodeDrag<FlowEditorNode>>(
    (_event, node, draggedNodes) => {
      clearScheduledDragSessionReset();
      dragSessionRef.current = createFlowNodeDragSession(
        draggedNodes.length > 0 ? draggedNodes : [node],
      );
    },
    [clearScheduledDragSessionReset],
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<FlowEditorNode>>(
    () => {
      clearScheduledDragSessionReset();
      dragSessionClearFrameRef.current = window.requestAnimationFrame(() => {
        dragSessionRef.current = null;
        dragSessionClearFrameRef.current = null;
      });
    },
    [clearScheduledDragSessionReset],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowEditorNode>[]) => {
      const dragSession = dragSessionRef.current;

      setNodes((currentNodes) => {
        const nextChanges =
          dragSession === null
            ? changes
            : changes.map((change) =>
                constrainFlowNodeChange({
                  axisLock: dragAxisLockRef.current,
                  change,
                  dragSession,
                  edges,
                  nodes: currentNodes,
                }),
              );

        return applyNodeChanges(nextChanges, currentNodes);
      });

      if (
        dragSession &&
        changes.some(
          (change) =>
            change.type === "position" &&
            change.dragging === false &&
            dragSession.draggedNodeIds.has(change.id),
        )
      ) {
        clearScheduledDragSessionReset();
        dragSessionRef.current = null;
      }
    },
    [clearScheduledDragSessionReset, edges, setNodes],
  );

  return {
    handleNodeDragStart,
    handleNodeDragStop,
    handleNodesChange,
  };
}

function getFlowNodeDragAxisLock(pressedKeys: Set<DragAxisKey>) {
  if (pressedKeys.has("KeyX") === pressedKeys.has("KeyY")) {
    return null;
  }

  return pressedKeys.has("KeyX") ? "fixX" : "fixY";
}

function isDragAxisKey(code: string): code is DragAxisKey {
  return code === "KeyX" || code === "KeyY";
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        "input, select, textarea, [contenteditable='true'], [role='textbox']",
      ),
    )
  );
}
