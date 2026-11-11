import type { FlowValidationIssue } from "@/features/flow/flow-validation";
import { useI18n } from "@/features/i18n/I18nProvider";

type FlowValidationPanelProps = {
  issues: FlowValidationIssue[];
  hasLoops: boolean;
  blockedConnectionMessage: string | null;
};

export function FlowValidationPanel({
  issues,
  hasLoops,
  blockedConnectionMessage,
}: FlowValidationPanelProps) {
  const { language, t } = useI18n();
  const errorIssues = issues.filter((issue) => issue.severity === "error");
  const warningIssues = issues.filter((issue) => issue.severity === "warning");

  return (
    <section className="workspace-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-950/[0.025]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">
          {t("flow.validation")}
        </h2>
        {issues.length > 0 ? (
          <p className="text-[10px] font-medium text-slate-500">
            {errorIssues.length} {language === "es" ? "errores" : "errors"} ·{" "}
            {warningIssues.length} {language === "es" ? "avisos" : "warnings"}
          </p>
        ) : null}
      </div>

      {issues.length === 0 ? (
        <p className="mt-3 rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2.5 text-xs leading-5 text-teal-900">
          {t("flow.validationOk")}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <ValidationIssueList
            issues={errorIssues}
            label={language === "es" ? "Errores" : "Errors"}
            t={t}
          />
          <ValidationIssueList
            issues={warningIssues}
            label={language === "es" ? "Advertencias" : "Warnings"}
            t={t}
          />
        </div>
      )}

      {blockedConnectionMessage ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-900">
          {t("flow.connectionBlocked")}{" "}
          {getLocalizedValidationMessage(blockedConnectionMessage, t)}
        </p>
      ) : null}

      {hasLoops ? (
        <p className="mt-3 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-xs leading-5 text-sky-900">
          {t("flow.loopDetected")}
        </p>
      ) : null}
    </section>
  );
}

function ValidationIssueList({
  issues,
  label,
  t,
}: {
  issues: FlowValidationIssue[];
  label: string;
  t: ReturnType<typeof useI18n>["t"];
}) {
  if (issues.length === 0) {
    return null;
  }

  const isWarning = issues[0]?.severity === "warning";

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <ul className="space-y-2 text-xs leading-5 text-slate-700">
        {issues.map((issue) => (
          <li
            key={issue.id}
            className={
              isWarning
                ? "rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-amber-950"
                : "rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2.5 text-rose-900"
            }
          >
            {getLocalizedValidationMessage(issue.message, t)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function getLocalizedValidationMessage(
  message: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (message === "Debe existir exactamente un bloque Inicio.") {
    return t("validation.startCountMissing");
  }

  const startCountMatch = message.match(
    /^Debe existir exactamente un bloque Inicio; hay (\d+)\.$/,
  );

  if (startCountMatch) {
    return t("validation.startCountMultiple", {
      count: startCountMatch[1],
    });
  }

  return message;
}
