import { Handle, type NodeProps } from "@xyflow/react";
import {
  getFlowHandlePosition,
  toReactFlowPosition,
} from "@/features/flow/handle-positions";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { FlowEditorNode, ReturnNodeConfig } from "@/types/flow";
import { useFlowNodeRenderContext } from "./FlowNodeRenderContext";
import { NodePortControls } from "./NodePortControls";

const fieldClassName =
  "nodrag nopan nowheel w-full rounded border border-rose-200 bg-white/90 px-2 py-1 text-xs text-rose-950 outline-none focus:border-rose-500";

export function ReturnNode({ data, id, selected }: NodeProps<FlowEditorNode>) {
  const { t } = useI18n();
  const { getExecution } = useFlowNodeRenderContext();
  const execution = getExecution(id);
  const config = getReturnConfig(data.config, t);
  const executionClassName = execution?.isCurrent
    ? "ring-4 ring-yellow-300 ring-offset-2"
    : execution?.isVisited
      ? "ring-2 ring-rose-200 ring-offset-1"
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
      className={`relative min-w-44 cursor-grab select-none rounded-md border-2 border-rose-700 bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-950 shadow-sm active:cursor-grabbing ${selectionClassName} ${executionClassName}`}
    >
      <Handle
        id="in"
        type="target"
        position={toReactFlowPosition(inputPosition)}
        className="!h-3 !w-3 !border-2 !border-white !bg-rose-700"
      />
      <p className="mb-2 text-xs font-semibold uppercase text-rose-700">
        {t("flow.return")}
      </p>
      <input
        aria-label={t("node.returnExpressionAria")}
        className={`${fieldClassName} font-mono`}
        value={config.expression}
        onChange={(event) =>
          data.onConfigChange(id, {
            expression: event.target.value,
          })
        }
        placeholder={t("flow.resultPlaceholder")}
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
        ]}
        onHandlePositionsChange={data.onHandlePositionsChange}
      />
    </div>
  );
}

function getReturnConfig(
  config: FlowEditorNode["data"]["config"],
  t: ReturnType<typeof useI18n>["t"],
) {
  if ("expression" in config && !("outputMode" in config)) {
    return config as ReturnNodeConfig;
  }

  return {
    expression: t("flow.returnFallback"),
  } satisfies ReturnNodeConfig;
}
