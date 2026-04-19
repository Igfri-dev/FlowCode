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
  const { t } = useI18n();

  return (
    <section className="rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50">
      <h2 className="text-base font-semibold text-neutral-950">
        {t("flow.validation")}
      </h2>

      {issues.length === 0 ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          {t("flow.validationOk")}
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-900 shadow-sm"
            >
              {getLocalizedValidationMessage(issue.message, t)}
            </li>
          ))}
        </ul>
      )}

      {blockedConnectionMessage ? (
        <p className="mt-3 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-900 shadow-sm">
          {t("flow.connectionBlocked")}{" "}
          {getLocalizedValidationMessage(blockedConnectionMessage, t)}
        </p>
      ) : null}

      {hasLoops ? (
        <p className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-900 shadow-sm">
          {t("flow.loopDetected")}
        </p>
      ) : null}
    </section>
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
