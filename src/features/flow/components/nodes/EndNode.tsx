import { Handle, type NodeProps } from "@xyflow/react";
import {
  getFlowHandlePosition,
  toReactFlowPosition,
} from "@/features/flow/handle-positions";
import type { FlowEditorNode } from "@/types/flow";
import { EditableNodeLabel } from "./EditableNodeLabel";
import { NodePortControls } from "./NodePortControls";

export function EndNode({ data, id, selected }: NodeProps<FlowEditorNode>) {
  const executionClassName = data.execution?.isCurrent
    ? "ring-4 ring-yellow-300 ring-offset-2"
    : data.execution?.isVisited
      ? "ring-2 ring-red-200 ring-offset-1"
      : "";
  const selectionClassName = selected
    ? "outline outline-2 outline-blue-500 outline-offset-4"
    : "";
  const inputPosition = getFlowHandlePosition({
    fallback: "top",
    handleId: "in",
    handlePositions: data.handlePositions,
  });

  return (
    <div
      className={`relative min-w-40 cursor-grab select-none rounded-full border-2 border-red-700 bg-red-50 px-6 py-3 text-center text-sm font-semibold text-red-950 shadow-sm active:cursor-grabbing ${selectionClassName} ${executionClassName}`}
    >
      <Handle
        id="in"
        type="target"
        position={toReactFlowPosition(inputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-red-700"
      />
      <EditableNodeLabel
        ariaLabel="Texto del bloque de fin"
        className="font-semibold text-red-950"
        value={data.label}
        onValueChange={(label) => data.onLabelChange(id, label)}
      />
      <NodePortControls
        nodeId={id}
        selected={selected}
        handlePositions={data.handlePositions}
        controls={[
          {
            id: "in",
            label: "Entrada",
            fallback: "top",
          },
        ]}
        onHandlePositionsChange={data.onHandlePositionsChange}
      />
    </div>
  );
}
