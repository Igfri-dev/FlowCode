import { Handle, type NodeProps } from "@xyflow/react";
import {
  getFlowHandlePosition,
  toReactFlowPosition,
} from "@/features/flow/handle-positions";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { FlowEditorNode, FlowHandlePosition } from "@/types/flow";
import { EditableNodeLabel } from "./EditableNodeLabel";
import { useFlowNodeRenderContext } from "./FlowNodeRenderContext";
import { NodePortControls } from "./NodePortControls";

export function DecisionNode({ data, id, selected }: NodeProps<FlowEditorNode>) {
  const { t } = useI18n();
  const { getExecution } = useFlowNodeRenderContext();
  const execution = getExecution(id);
  const activeBranch = execution?.activeBranch;
  const inputPosition = getFlowHandlePosition({
    fallback: "top",
    handleId: "in",
    handlePositions: data.handlePositions,
  });
  const yesPosition = getFlowHandlePosition({
    fallback: "left",
    handleId: "yes",
    handlePositions: data.handlePositions,
  });
  const noPosition = getFlowHandlePosition({
    fallback: "right",
    handleId: "no",
    handlePositions: data.handlePositions,
  });
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
      {execution?.isCurrent ? (
        <div className="absolute -inset-2 bg-yellow-300 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      ) : null}
      {execution?.isVisited && !execution.isCurrent ? (
        <div className="absolute -inset-1 bg-cyan-200 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      ) : null}
      <div className="absolute inset-0 bg-cyan-600 shadow-sm [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      <div className="absolute inset-[3px] bg-cyan-50 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      <Handle
        id="in"
        type="target"
        position={toReactFlowPosition(inputPosition)}
        className="!z-20 !h-4 !w-4 !border-2 !border-white !bg-cyan-700"
      />
      <EditableNodeLabel
        ariaLabel={t("node.decisionConditionAria")}
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
        position={toReactFlowPosition(yesPosition)}
        className={`!z-20 !h-4 !w-4 !border-2 !border-white ${activeBranch === "yes" ? "!bg-yellow-500" : "!bg-cyan-700"}`}
      />
      <span
        className={`absolute z-10 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${getBranchLabelClassName(yesPosition, "yes")} ${yesBranchClassName}`}
      >
        {t("flow.yes")}
      </span>
      <span
        className={`absolute z-10 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${getBranchLabelClassName(noPosition, "no")} ${noBranchClassName}`}
      >
        {t("flow.no")}
      </span>
      <Handle
        id="no"
        type="source"
        position={toReactFlowPosition(noPosition)}
        className={`!z-20 !h-4 !w-4 !border-2 !border-white ${activeBranch === "no" ? "!bg-yellow-500" : "!bg-cyan-700"}`}
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
            id: "yes",
            label: t("flow.yes"),
            fallback: "left",
          },
          {
            id: "no",
            label: t("flow.no"),
            fallback: "right",
          },
        ]}
        onHandlePositionsChange={data.onHandlePositionsChange}
      />
    </div>
  );
}

function getBranchLabelClassName(
  position: FlowHandlePosition,
  branch: "yes" | "no",
) {
  const branchOffset =
    branch === "yes" ? "-translate-x-10" : "translate-x-10";

  if (position === "top") {
    return `left-1/2 top-5 -translate-y-1/2 ${branchOffset}`;
  }

  if (position === "bottom") {
    return `bottom-5 left-1/2 translate-y-1/2 ${branchOffset}`;
  }

  if (position === "right") {
    return branch === "yes"
      ? "right-5 top-1/2 -translate-y-8"
      : "right-5 top-1/2 translate-y-2";
  }

  return branch === "yes"
    ? "left-5 top-1/2 -translate-y-8"
    : "left-5 top-1/2 translate-y-2";
}
