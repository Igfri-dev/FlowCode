import { useEffect } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";
import { flowHandlePositionOptions } from "@/features/flow/handle-positions";
import type {
  FlowHandlePosition,
  FlowNodeHandleId,
  FlowNodeHandlePositions,
} from "@/types/flow";

type NodePortControl = {
  id: FlowNodeHandleId;
  label: string;
  fallback: FlowHandlePosition;
};

type NodePortControlsProps = {
  nodeId: string;
  selected: boolean;
  handlePositions?: FlowNodeHandlePositions;
  controls: NodePortControl[];
  onHandlePositionsChange: (
    nodeId: string,
    handlePositions: FlowNodeHandlePositions,
  ) => void;
};

export function NodePortControls({
  nodeId,
  selected,
  handlePositions,
  controls,
  onHandlePositionsChange,
}: NodePortControlsProps) {
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [handlePositions, nodeId, updateNodeInternals]);

  if (!selected) {
    return null;
  }

  return (
    <div className="nodrag nopan nowheel absolute left-1/2 top-full z-30 mt-2 w-44 -translate-x-1/2 rounded-md border border-neutral-300 bg-white p-2 text-left text-[11px] font-medium text-neutral-700 shadow-md">
      <p className="mb-1 text-[10px] font-semibold uppercase text-neutral-500">
        Puertos
      </p>
      <div className="flex flex-col gap-1.5">
        {controls.map((control) => (
          <label
            key={control.id}
            className="flex items-center justify-between gap-2"
          >
            <span>{control.label}</span>
            <select
              className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-[11px] text-neutral-800 outline-none focus:border-blue-500"
              value={handlePositions?.[control.id] ?? control.fallback}
              onChange={(event) =>
                onHandlePositionsChange(nodeId, {
                  ...handlePositions,
                  [control.id]: event.target.value as FlowHandlePosition,
                })
              }
            >
              {flowHandlePositionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
