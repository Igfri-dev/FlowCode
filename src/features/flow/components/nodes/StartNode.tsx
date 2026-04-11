import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowEditorNode } from "@/types/flow";
import { EditableNodeLabel } from "./EditableNodeLabel";

export function StartNode({ data, id }: NodeProps<FlowEditorNode>) {
  const executionClassName = data.execution?.isCurrent
    ? "ring-4 ring-yellow-300 ring-offset-2"
    : data.execution?.isVisited
      ? "ring-2 ring-emerald-200 ring-offset-1"
      : "";

  return (
    <div
      className={`min-w-40 rounded-full border-2 border-emerald-600 bg-emerald-50 px-6 py-3 text-center text-sm font-semibold text-emerald-950 shadow-sm ${executionClassName}`}
    >
      <EditableNodeLabel
        ariaLabel="Texto del bloque de inicio"
        className="font-semibold text-emerald-950"
        value={data.label}
        onValueChange={(label) => data.onLabelChange(id, label)}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-emerald-600"
      />
    </div>
  );
}
