import { Handle, type NodeProps } from "@xyflow/react";
import {
  getFlowHandlePosition,
  toReactFlowPosition,
} from "@/features/flow/handle-positions";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { FlowEditorNode, OutputNodeConfig } from "@/types/flow";
import { useFlowNodeRenderContext } from "./FlowNodeRenderContext";
import { NodePortControls } from "./NodePortControls";

const fieldClassName =
  "nodrag nopan nowheel w-full rounded border border-amber-200 bg-white/90 px-2 py-1 text-xs text-amber-950 outline-none focus:border-amber-500";

export function OutputNode({ data, id, selected }: NodeProps<FlowEditorNode>) {
  const { t } = useI18n();
  const { getExecution } = useFlowNodeRenderContext();
  const execution = getExecution(id);
  const config = getOutputConfig(data.config, t);
  const executionClassName = execution?.isCurrent
    ? "ring-4 ring-yellow-300 ring-offset-2"
    : execution?.isVisited
      ? "ring-2 ring-amber-200 ring-offset-1"
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
      className={`relative min-w-48 cursor-grab select-none rounded-md border-2 border-amber-600 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 shadow-sm [transform:skew(-8deg)] active:cursor-grabbing ${selectionClassName} ${executionClassName}`}
    >
      <Handle
        id="in"
        type="target"
        position={toReactFlowPosition(inputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-amber-700"
      />
      <div className="[transform:skew(8deg)]">
        <p className="mb-2 text-center text-xs font-semibold uppercase text-amber-700">
          {t("flow.output")}
        </p>
        <div className="space-y-2">
          <textarea
            aria-label={t("node.outputExpressionAria")}
            className={`${fieldClassName} resize-none font-mono`}
            rows={2}
            value={config.expression}
            onChange={(event) =>
              data.onConfigChange(id, {
                ...config,
                expression: event.target.value,
              })
            }
          />
          <select
            aria-label={t("node.outputModeAria")}
            className={fieldClassName}
            value={config.outputMode}
            onChange={(event) =>
              data.onConfigChange(id, {
                ...config,
                outputMode: event.target.value as OutputNodeConfig["outputMode"],
              })
            }
          >
            <option value="expression">{t("flow.expression")}</option>
            <option value="text">{t("flow.literalText")}</option>
          </select>
        </div>
      </div>
      <Handle
        id="out"
        type="source"
        position={toReactFlowPosition(outputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-amber-700"
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

function getOutputConfig(
  config: FlowEditorNode["data"]["config"],
  t: ReturnType<typeof useI18n>["t"],
) {
  if ("outputMode" in config) {
    return config as OutputNodeConfig;
  }

  return {
    expression: t("flow.outputFallback"),
    outputMode: "expression",
  } satisfies OutputNodeConfig;
}
