import { Handle, type NodeProps } from "@xyflow/react";
import {
  getFlowHandlePosition,
  toReactFlowPosition,
} from "@/features/flow/handle-positions";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { FlowEditorNode, InputNodeConfig } from "@/types/flow";
import { NodePortControls } from "./NodePortControls";

const fieldClassName =
  "nodrag nopan nowheel h-6 w-full rounded border border-sky-200 bg-white/90 px-1.5 py-0.5 text-[11px] text-sky-950 outline-none focus:border-sky-500";

export function InputNode({ data, id, selected }: NodeProps<FlowEditorNode>) {
  const { t } = useI18n();
  const config = getInputConfig(data.config, t);
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
          {t("flow.input")}
        </p>
        <div className="space-y-1.5">
          <textarea
            aria-label={t("node.inputPromptAria")}
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
            aria-label={t("node.inputVariableAria")}
            className={fieldClassName}
            value={config.variableName}
            onChange={(event) =>
              data.onConfigChange(id, {
                ...config,
                variableName: event.target.value,
              })
            }
            placeholder={t("flow.variablePlaceholder")}
          />
          <select
            aria-label={t("node.inputTypeAria")}
            className={fieldClassName}
            value={config.inputType}
            onChange={(event) =>
              data.onConfigChange(id, {
                ...config,
                inputType: event.target.value as InputNodeConfig["inputType"],
              })
            }
          >
            <option value="text">{t("flow.text")}</option>
            <option value="number">{t("flow.number")}</option>
            <option value="boolean">{t("flow.boolean")}</option>
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

function getInputConfig(
  config: FlowEditorNode["data"]["config"],
  t: ReturnType<typeof useI18n>["t"],
) {
  if ("prompt" in config) {
    return config as InputNodeConfig;
  }

  return {
    prompt: t("flow.inputPromptFallback"),
    variableName: t("flow.inputVariableFallback"),
    inputType: "text",
  } satisfies InputNodeConfig;
}
