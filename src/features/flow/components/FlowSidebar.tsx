import type { FlowNodeType } from "@/types/flow";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { TranslationKey } from "@/features/i18n/translations";

type FlowSidebarProps = {
  layout?: "vertical" | "horizontal";
  onAddNode: (type: FlowNodeType) => void;
};

const blockActions: Array<{
  labelKey: TranslationKey;
  type: FlowNodeType;
  markerClassName: string;
}> = [
  {
    labelKey: "flow.addStart",
    type: "start",
    markerClassName: "bg-emerald-500",
  },
  {
    labelKey: "flow.addEnd",
    type: "end",
    markerClassName: "bg-red-600",
  },
  {
    labelKey: "flow.addProcess",
    type: "process",
    markerClassName: "bg-neutral-500",
  },
  {
    labelKey: "flow.addInput",
    type: "input",
    markerClassName: "bg-sky-500",
  },
  {
    labelKey: "flow.addOutput",
    type: "output",
    markerClassName: "bg-amber-500",
  },
  {
    labelKey: "flow.addDecision",
    type: "decision",
    markerClassName: "bg-cyan-500",
  },
  {
    labelKey: "flow.addFunctionCall",
    type: "functionCall",
    markerClassName: "bg-violet-500",
  },
  {
    labelKey: "flow.addReturn",
    type: "return",
    markerClassName: "bg-rose-500",
  },
];

export function FlowSidebar({
  layout = "vertical",
  onAddNode,
}: FlowSidebarProps) {
  const { t } = useI18n();
  const isHorizontal = layout === "horizontal";
  const rootClassName = isHorizontal
    ? "flex flex-col gap-3 rounded-lg border border-neutral-300/80 bg-white p-3 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50"
    : "flex flex-col gap-4 rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50";
  const actionListClassName = isHorizontal
    ? "flex max-w-[calc(100vw-5rem)] gap-2 overflow-x-visible pb-1 "
    : "flex flex-col gap-2";
  const buttonClassName = isHorizontal
    ? "group flex shrink-0 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-xs font-semibold text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
    : "group flex items-center gap-3 rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm";

  return (
    <aside className={rootClassName}>
      <div className={isHorizontal ? "flex items-center gap-3" : ""}>
        <h2 className="text-base font-semibold text-neutral-950">
          {t("flow.blocks")}
        </h2>
        <p
          className={
            isHorizontal
              ? "text-xs text-neutral-600"
              : "mt-1 text-sm text-neutral-600"
          }
        >
          {t("flow.blocksHelp")}
        </p>
      </div>

      <div className={actionListClassName}>
        {blockActions.map((action) => (
          <button
            key={action.type}
            type="button"
            onClick={() => onAddNode(action.type)}
            className={buttonClassName}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125 ${action.markerClassName}`}
              aria-hidden="true"
            />
            {isHorizontal
              ? t(action.labelKey).replace(/^Agregar |^Add /, "")
              : t(action.labelKey)}
          </button>
        ))}
      </div>
    </aside>
  );
}
