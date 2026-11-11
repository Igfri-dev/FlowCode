import { useI18n } from "@/features/i18n/I18nProvider";

type FlowCodePanelProps = {
  code: string;
  warnings: string[];
  onGenerateCode: () => void;
};

export function FlowCodePanel({
  code,
  warnings,
  onGenerateCode,
}: FlowCodePanelProps) {
  const { t } = useI18n();
  const codeToShow = code || t("flow.codePlaceholder");

  return (
    <section className="workspace-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-950/[0.025]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {t("flow.codeTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t("flow.codeHelp")}
          </p>
        </div>

        <button
          type="button"
          onClick={onGenerateCode}
          className="fc-button fc-button--primary shrink-0"
        >
          {t("flow.generateCode")}
        </button>
      </div>

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
          <p className="text-xs font-semibold text-amber-950">
            {t("flow.warnings")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-900">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-6 text-emerald-200">
        <code>{codeToShow}</code>
      </pre>
    </section>
  );
}
