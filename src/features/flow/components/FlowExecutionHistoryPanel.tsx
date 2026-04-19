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
    <section className="rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-950">
          {t("flow.history")}
        </h2>
        {history.length > 0 ? (
          <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-600">
            {t("flow.historyRecent")}
          </span>
        ) : null}
      </div>

      {history.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          {t("flow.historyEmpty")}
        </p>
      ) : (
        <ol className="mt-3 max-h-110 space-y-2 overflow-y-auto pr-1 text-sm">
          {latestFirstHistory.map((item, index) => (
            <li
              key={item.id}
              className={`rounded-md border px-3 py-2 transition-colors ${
                index === 0
                  ? "border-emerald-300 bg-emerald-50/80"
                  : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-neutral-900">
                  {item.step}. {nodeTypeLabels[item.nodeType]}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {index === 0 ? (
                    <span className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                      {t("flow.latest")}
                    </span>
                  ) : null}
                  {item.branchLabel ? (
                    <span className="rounded-md bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-900">
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
              <p className="mt-1 text-xs font-medium text-neutral-500">
                {getLocalizedDiagramName(item.diagramName, t)}
              </p>
              <p className="mt-1 font-mono text-xs text-neutral-700">
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
