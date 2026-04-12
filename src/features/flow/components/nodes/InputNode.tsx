import { Handle, type NodeProps } from "@xyflow/react";
import {
  getFlowHandlePosition,
  toReactFlowPosition,
} from "@/features/flow/handle-positions";
import type { FlowEditorNode, InputNodeConfig } from "@/types/flow";
import { NodePortControls } from "./NodePortControls";

const fieldClassName =
  "nodrag nopan nowheel h-6 w-full rounded border border-sky-200 bg-white/90 px-1.5 py-0.5 text-[11px] text-sky-950 outline-none focus:border-sky-500";

export function InputNode({ data, id, selected }: NodeProps<FlowEditorNode>) {
  const config = getInputConfig(data.config);
  const executionClassName = data.execution?.isCurrent
    ? "ring-4 ring-yellow-300 ring-offset-2"
    : data.execution?.isVisited
      ? "ring-2 ring-sky-200 ring-offset-1"
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
      className={`relative w-44 cursor-grab select-none rounded-md border-2 border-sky-600 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-950 shadow-sm [transform:skew(-8deg)] active:cursor-grabbing ${selectionClassName} ${executionClassName}`}
    >
      <Handle
        id="in"
        type="target"
        position={toReactFlowPosition(inputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-sky-700"
      />
      <div className="[transform:skew(8deg)]">
        <p className="mb-1 text-center text-[11px] font-semibold uppercase text-sky-700">
          Entrada
        </p>
        <div className="space-y-1.5">
          <textarea
            aria-label="Texto de la pregunta"
            className={`${fieldClassName} resize-none overflow-hidden`}
            rows={1}
            value={config.prompt}
            onChange={(event) =>
              data.onConfigChange(id, {
                ...config,
                prompt: event.target.value,
              })
            }
          />
          <input
            aria-label="Variable donde se guarda la entrada"
            className={fieldClassName}
            value={config.variableName}
            onChange={(event) =>
              data.onConfigChange(id, {
                ...config,
                variableName: event.target.value,
              })
            }
            placeholder="variable"
          />
          <select
            aria-label="Tipo de entrada"
            className={fieldClassName}
            value={config.inputType}
            onChange={(event) =>
              data.onConfigChange(id, {
                ...config,
                inputType: event.target.value as InputNodeConfig["inputType"],
              })
            }
          >
            <option value="text">Texto</option>
            <option value="number">Numero</option>
            <option value="boolean">Booleano</option>
          </select>
        </div>
      </div>
      <Handle
        id="out"
        type="source"
        position={toReactFlowPosition(outputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-sky-700"
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

function getInputConfig(config: FlowEditorNode["data"]["config"]) {
  if ("prompt" in config) {
    return config as InputNodeConfig;
  }

  return {
    prompt: "Ingresa un valor",
    variableName: "valor",
    inputType: "text",
  } satisfies InputNodeConfig;
}
