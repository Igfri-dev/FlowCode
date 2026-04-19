import { Handle, type NodeProps } from "@xyflow/react";
import {
  getFlowHandlePosition,
  toReactFlowPosition,
} from "@/features/flow/handle-positions";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { FlowEditorNode, FunctionCallNodeConfig } from "@/types/flow";
import { NodePortControls } from "./NodePortControls";

const fieldClassName =
  "nodrag nopan nowheel h-6 w-full rounded border border-violet-200 bg-white/90 px-1.5 py-0.5 text-[11px] text-violet-950 outline-none focus:border-violet-500";

export function FunctionCallNode({
  data,
  id,
  selected,
}: NodeProps<FlowEditorNode>) {
  const { t } = useI18n();
  const config = getFunctionCallConfig(data.config);
  const argumentText = config.argsText ?? config.args.join(", ");
  const selectedFunction = data.availableFunctions?.find(
    (flowFunction) => flowFunction.id === config.functionId,
  );
  const executionClassName = data.execution?.isCurrent
    ? "ring-4 ring-yellow-300 ring-offset-2"
    : data.execution?.isVisited
      ? "ring-2 ring-violet-200 ring-offset-1"
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
      className={`relative w-48 cursor-grab select-none rounded-md border-2 border-violet-600 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-950 shadow-sm active:cursor-grabbing ${selectionClassName} ${executionClassName}`}
    >
      <Handle
        id="in"
        type="target"
        position={toReactFlowPosition(inputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-violet-700"
      />
      <p className="mb-1 text-center text-[11px] font-semibold uppercase text-violet-700">
        {t("flow.functionCall")}
      </p>
      <div className="space-y-1.5">
        <select
          aria-label={t("node.functionToCallAria")}
          className={fieldClassName}
          value={config.functionId}
          onChange={(event) =>
            data.onConfigChange(id, {
              ...config,
              functionId: event.target.value,
            })
          }
        >
          <option value="">{t("flow.selectFunction")}</option>
          {data.availableFunctions?.map((flowFunction) => (
            <option key={flowFunction.id} value={flowFunction.id}>
              {flowFunction.name}
            </option>
          ))}
        </select>
        <input
          aria-label={t("node.callArgumentsAria")}
          className={`${fieldClassName} font-mono`}
          value={argumentText}
          onChange={(event) => {
            data.onConfigChange(id, {
              ...config,
              argsText: event.target.value,
              args: splitArguments(event.target.value),
            });
          }}
          placeholder={
            selectedFunction ? selectedFunction.parameters.join(", ") : "a, b"
          }
        />
        <input
          aria-label={t("node.callReturnVariableAria")}
          className={fieldClassName}
          value={config.assignTo ?? ""}
          onChange={(event) =>
            data.onConfigChange(id, {
              ...config,
              assignTo: event.target.value,
            })
          }
          placeholder={t("flow.saveReturnPlaceholder")}
        />
      </div>
      <Handle
        id="out"
        type="source"
        position={toReactFlowPosition(outputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-violet-700"
      />
      <NodePortControls
        nodeId={id}
        selected={selected}
        handlePositions={data.handlePositions}
        controls={[
          {
            id: "in",
            label: t("flow.inPort"),
            fallback: "top",
          },
          {
            id: "out",
            label: t("flow.outPort"),
            fallback: "bottom",
          },
        ]}
        onHandlePositionsChange={data.onHandlePositionsChange}
      />
    </div>
  );
}

function getFunctionCallConfig(config: FlowEditorNode["data"]["config"]) {
  if ("functionId" in config) {
    return config as FunctionCallNodeConfig;
  }

  return {
    functionId: "",
    args: [],
    assignTo: "",
  } satisfies FunctionCallNodeConfig;
}

function splitArguments(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
