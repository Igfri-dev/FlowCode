import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowEditorNode } from "@/types/flow";
import { EditableNodeLabel } from "./EditableNodeLabel";

export function DecisionNode({ data, id, selected }: NodeProps<FlowEditorNode>) {
  const activeBranch = data.execution?.activeBranch;
  const yesBranchClassName =
    activeBranch === "yes"
      ? "border-yellow-300 bg-yellow-100 text-yellow-950 shadow-sm"
      : "border-cyan-200 bg-cyan-50 text-cyan-800";
  const noBranchClassName =
    activeBranch === "no"
      ? "border-yellow-300 bg-yellow-100 text-yellow-950 shadow-sm"
      : "border-cyan-200 bg-cyan-50 text-cyan-800";

  return (
    <div className="relative flex min-h-36 min-w-48 cursor-grab select-none items-center justify-center px-14 py-12 active:cursor-grabbing">
      {selected ? (
        <div className="absolute -inset-4 bg-blue-500 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      ) : null}
      {data.execution?.isCurrent ? (
        <div className="absolute -inset-2 bg-yellow-300 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      ) : null}
      {data.execution?.isVisited && !data.execution.isCurrent ? (
        <div className="absolute -inset-1 bg-cyan-200 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      ) : null}
      <div className="absolute inset-0 bg-cyan-600 shadow-sm [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      <div className="absolute inset-[3px] bg-cyan-50 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      <Handle
        id="in"
        type="target"
        position={Position.Top}
        className="!top-0 !z-20 !h-4 !w-4 !border-2 !border-white !bg-cyan-700"
      />
      <EditableNodeLabel
        ariaLabel="Condición del bloque de decisión"
        className="relative z-10 max-w-24 text-sm font-semibold leading-5 text-cyan-950"
        value={"condition" in data.config ? data.config.condition : data.label}
        onValueChange={(condition) =>
          data.onConfigChange(id, {
            condition,
          })
        }
        rows={2}
      />
      <Handle
        id="yes"
        type="source"
        position={Position.Left}
        className={`!left-1 !z-20 !h-4 !w-4 !border-2 !border-white ${activeBranch === "yes" ? "!bg-yellow-500" : "!bg-cyan-700"}`}
      />
      <span
        className={`absolute left-5 top-1/2 z-10 -translate-y-8 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${yesBranchClassName}`}
      >
        Sí
      </span>
      <span
        className={`absolute right-5 top-1/2 z-10 -translate-y-8 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${noBranchClassName}`}
      >
        No
      </span>
      <Handle
        id="no"
        type="source"
        position={Position.Right}
        className={`!right-1 !z-20 !h-4 !w-4 !border-2 !border-white ${activeBranch === "no" ? "!bg-yellow-500" : "!bg-cyan-700"}`}
      />
    </div>
  );
}
