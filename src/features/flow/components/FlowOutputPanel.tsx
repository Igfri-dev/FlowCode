import type { FlowExecutionOutputItem } from "@/features/flow/execution";
import { useI18n } from "@/features/i18n/I18nProvider";

type FlowOutputPanelProps = {
  outputs: FlowExecutionOutputItem[];
};

export function FlowOutputPanel({ outputs }: FlowOutputPanelProps) {
  const { t } = useI18n();

  return (
    <section className="workspace-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-950/[0.025]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">
          {t("flow.outputs")}
        </h2>
        <span aria-hidden="true" className="font-mono text-xs text-slate-400">
          &gt;_
        </span>
      </div>

      {outputs.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-xs leading-5 text-slate-500">
          {t("flow.outputsEmpty")}
        </p>
      ) : (
        <ol className="mt-3 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-slate-950 p-3 text-sm">
          {outputs.map((output) => (
            <li key={output.id} className="border-l border-slate-700 pl-3">
              <span className="text-[10px] font-medium text-slate-400">
                {t("flow.step", { step: output.step })}
              </span>
              <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-emerald-300">
                {output.content}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
