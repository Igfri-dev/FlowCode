import type { FlowExecutionHistoryItem } from "@/features/flow/execution";
import { useI18n } from "@/features/i18n/I18nProvider";

type FlowExecutionHistoryPanelProps = {
  history: FlowExecutionHistoryItem[];
};

export function FlowExecutionHistoryPanel({
  history,
}: FlowExecutionHistoryPanelProps) {
  const { t } = useI18n();
  const latestFirstHistory = [...history].reverse();
  const nodeTypeLabels: Record<FlowExecutionHistoryItem["nodeType"], string> = {
    start: t("flow.start"),
    end: t("flow.end"),
    process: t("flow.process"),
    decision: t("flow.decision"),
    input: t("flow.input"),
    output: t("flow.output"),
    functionCall: t("flow.functionCall"),
    return: t("flow.return"),
  };

  return (
    <section className="workspace-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-950/[0.025]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">
          {t("flow.history")}
        </h2>
        {history.length > 0 ? (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {t("flow.historyRecent")}
          </span>
        ) : null}
      </div>

      {history.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-xs leading-5 text-slate-500">
          {t("flow.historyEmpty")}
        </p>
      ) : (
        <ol className="mt-3 max-h-110 space-y-2 overflow-y-auto pr-1 text-sm">
          {latestFirstHistory.map((item, index) => (
            <li
              key={item.id}
              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                index === 0
                  ? "border-teal-200 bg-teal-50/60"
                  : "border-slate-100 bg-slate-50/70 hover:bg-slate-100/70"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-800">
                  {item.step}. {nodeTypeLabels[item.nodeType]}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {index === 0 ? (
                    <span className="rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
                      {t("flow.latest")}
                    </span>
                  ) : null}
                  {item.branchLabel ? (
                    <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                      {t("flow.branch", {
                        label:
                          item.branchLabel === "Si"
                            ? t("flow.yes")
                            : t("flow.no"),
                      })}
                    </span>
                  ) : null}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {getLocalizedDiagramName(item.diagramName, t)}
              </p>
              <p className="mt-1 break-words font-mono text-[11px] leading-5 text-slate-600">
                {getLocalizedHistoryContent(item.content, item.nodeType, t)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function getLocalizedDiagramName(
  diagramName: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (diagramName === "Principal") {
    return t("flow.main");
  }

  const functionNameMatch = diagramName.match(/^Funcion\s+(.+)$/);

  if (functionNameMatch) {
    return `${t("flow.function")} ${functionNameMatch[1]}`;
  }

  return diagramName;
}

function getLocalizedHistoryContent(
  content: string,
  nodeType: FlowExecutionHistoryItem["nodeType"],
  t: ReturnType<typeof useI18n>["t"],
) {
  if (nodeType === "start") {
    return t("flow.start");
  }

  if (nodeType === "end") {
    return t("flow.end");
  }

  const functionCallMatch = content.match(/^llamar funcion\((.*)\)$/);

  if (functionCallMatch) {
    return `${t("flow.callFunctionHistory")}(${functionCallMatch[1]})`;
  }

  return content;
}
