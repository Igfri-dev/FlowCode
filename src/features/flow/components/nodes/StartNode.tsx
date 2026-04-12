import { Handle, type NodeProps } from "@xyflow/react";
import {
  getFlowHandlePosition,
  toReactFlowPosition,
} from "@/features/flow/handle-positions";
import type { FlowEditorNode } from "@/types/flow";
import { EditableNodeLabel } from "./EditableNodeLabel";
import { NodePortControls } from "./NodePortControls";

export function StartNode({ data, id, selected }: NodeProps<FlowEditorNode>) {
  const executionClassName = data.execution?.isCurrent
    ? "ring-4 ring-yellow-300 ring-offset-2"
    : data.execution?.isVisited
      ? "ring-2 ring-emerald-200 ring-offset-1"
      : "";
  const selectionClassName = selected
    ? "outline outline-2 outline-blue-500 outline-offset-4"
    : "";
  const outputPosition = getFlowHandlePosition({
    fallback: "bottom",
    handleId: "out",
    handlePositions: data.handlePositions,
  });

  return (
    <div
      className={`relative min-w-40 cursor-grab select-none rounded-full border-2 border-emerald-600 bg-emerald-50 px-6 py-3 text-center text-sm font-semibold text-emerald-950 shadow-sm active:cursor-grabbing ${selectionClassName} ${executionClassName}`}
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
        position={toReactFlowPosition(outputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-emerald-600"
      />
      <NodePortControls
        nodeId={id}
        selected={selected}
        handlePositions={data.handlePositions}
        controls={[
          {
            id: "out",
            label: "Salida",
            fallback: "bottom",
          },
        ]}
        onHandlePositionsChange={data.onHandlePositionsChange}
      />
    </div>
  );
}
