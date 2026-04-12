import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowEditorNode } from "@/types/flow";
import { EditableNodeLabel } from "./EditableNodeLabel";

export function ProcessNode({ data, id, selected }: NodeProps<FlowEditorNode>) {
  const executionClassName = data.execution?.isCurrent
    ? "ring-4 ring-yellow-300 ring-offset-2"
    : data.execution?.isVisited
      ? "ring-2 ring-neutral-300 ring-offset-1"
      : "";
  const selectionClassName = selected
    ? "outline outline-2 outline-blue-500 outline-offset-4"
    : "";

  return (
    <div
      className={`min-w-40 cursor-grab select-none rounded-md border-2 border-neutral-500 bg-white px-5 py-4 text-center text-sm font-medium text-neutral-900 shadow-sm active:cursor-grabbing ${selectionClassName} ${executionClassName}`}
    >
      <Handle
        id="in"
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-neutral-600"
      />
      <EditableNodeLabel
        ariaLabel="Instrucción del bloque de proceso"
        className="font-medium text-neutral-900"
        value={
          "instruction" in data.config ? data.config.instruction : data.label
        }
        onValueChange={(instruction) =>
          data.onConfigChange(id, {
            instruction,
          })
        }
      />
      <Handle
        id="out"
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-neutral-600"
      />
    </div>
  );
}
