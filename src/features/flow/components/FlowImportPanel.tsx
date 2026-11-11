import { useI18n } from "@/features/i18n/I18nProvider";

type FlowImportPanelProps = {
  code: string;
  message: string | null;
  status: "idle" | "success" | "error";
  warnings: string[];
  onCodeChange: (code: string) => void;
  onImportCode: () => void;
};

export function FlowImportPanel({
  code,
  message,
  status,
  warnings,
  onCodeChange,
  onImportCode,
}: FlowImportPanelProps) {
  const { t } = useI18n();

  return (
    <section className="workspace-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-950/[0.025]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {t("flow.importTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t("flow.importHelp")}
          </p>
        </div>

        <button
          type="button"
          onClick={onImportCode}
          className="fc-button fc-button--primary shrink-0"
        >
          {t("flow.importButton")}
        </button>
      </div>

      <textarea
        aria-label={t("flow.importAria")}
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
        placeholder={`let x = 0;
while (x < 5) {
  x = x + 1;
}`}
        className="fc-field mt-4 min-h-48 w-full resize-y bg-slate-50/60 p-3 font-mono text-xs leading-6"
      />

      {message ? (
        <p
          className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${
            status === "error"
              ? "border-rose-200 bg-rose-50/70 text-rose-900"
              : "border-teal-200 bg-teal-50/70 text-teal-900"
          }`}
        >
          {message}
        </p>
      ) : null}

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
    </section>
  );
}
