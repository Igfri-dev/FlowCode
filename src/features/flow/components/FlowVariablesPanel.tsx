import type { ExecutionVariables } from "@/features/flow/execution";
import { useI18n } from "@/features/i18n/I18nProvider";

type FlowVariablesPanelProps = {
  variables: ExecutionVariables;
};

export function FlowVariablesPanel({ variables }: FlowVariablesPanelProps) {
  const { t } = useI18n();
  const variableEntries = Object.entries(variables);

  return (
    <section className="workspace-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-950/[0.025]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">
          {t("flow.variables")}
        </h2>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-500">
          {variableEntries.length}
        </span>
      </div>

      {variableEntries.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-xs leading-5 text-slate-500">
          {t("flow.variablesEmpty")}
        </p>
      ) : (
        <dl className="mt-3 divide-y divide-slate-100 text-xs">
          {variableEntries.map(([name, value]) => (
            <div
              key={name}
              className="flex items-start justify-between gap-3 px-1 py-2.5"
            >
              <dt
                className="min-w-0 truncate font-mono font-medium text-teal-800"
                title={name}
              >
                {name}
              </dt>
              <dd className="max-w-[60%] break-all text-right font-mono text-slate-700">
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
