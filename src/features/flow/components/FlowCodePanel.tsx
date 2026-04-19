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
    <section className="rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">
            {t("flow.codeTitle")}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {t("flow.codeHelp")}
          </p>
        </div>

        <button
          type="button"
          onClick={onGenerateCode}
          className="rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
        >
          {t("flow.generateCode")}
        </button>
      </div>

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2">
          <p className="text-sm font-semibold text-yellow-950">
            {t("flow.warnings")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-yellow-900">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm leading-6 text-neutral-50 shadow-inner ring-1 ring-neutral-900">
        <code>{codeToShow}</code>
      </pre>
    </section>
  );
}
