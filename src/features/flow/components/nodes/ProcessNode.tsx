import { Handle, type NodeProps } from "@xyflow/react";
import {
  getFlowHandlePosition,
  toReactFlowPosition,
} from "@/features/flow/handle-positions";
import type { FlowEditorNode } from "@/types/flow";
import { EditableNodeLabel } from "./EditableNodeLabel";
import { NodePortControls } from "./NodePortControls";

export function ProcessNode({ data, id, selected }: NodeProps<FlowEditorNode>) {
  const instruction =
    "instruction" in data.config ? data.config.instruction : data.label;
  const executionClassName = data.execution?.isCurrent
    ? "ring-4 ring-yellow-300 ring-offset-2"
    : data.execution?.isVisited
      ? "ring-2 ring-neutral-300 ring-offset-1"
      : "";
  const selectionClassName = selected
    ? "outline outline-2 outline-blue-500 outline-offset-4"
    : "";
  const inputPosition = getFlowHandlePosition({
    fallback: "top",
    handleId: "in",
    handlePositions: data.handlePositions,
  });
  const outputPosition = getFlowHandlePosition({
    fallback: "bottom",
    handleId: "out",
    handlePositions: data.handlePositions,
  });

  return (
    <div
      className={`relative min-w-40 max-w-80 cursor-grab select-none rounded-md border-2 border-neutral-500 bg-white px-5 py-4 text-center text-sm font-medium text-neutral-900 shadow-sm active:cursor-grabbing ${selectionClassName} ${executionClassName}`}
    >
      <Handle
        id="in"
        type="target"
        position={toReactFlowPosition(inputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-neutral-600"
      />
      <EditableNodeLabel
        ariaLabel="Instrucción del bloque de proceso"
        className="font-mono text-xs leading-5 text-neutral-900 [overflow-wrap:anywhere]"
        value={instruction}
        onValueChange={(instruction) =>
          data.onConfigChange(id, {
            instruction,
          })
        }
        rows={getInstructionRows(instruction)}
        textAlign="left"
        autoResize
      />
      <Handle
        id="out"
        type="source"
        position={toReactFlowPosition(outputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-neutral-600"
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

function getInstructionRows(instruction: string) {
  return Math.max(1, instruction.split(/\r\n|\r|\n/).length);
}
