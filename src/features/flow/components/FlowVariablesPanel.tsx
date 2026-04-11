import type { ExecutionVariables } from "@/features/flow/execution";

type FlowVariablesPanelProps = {
  variables: ExecutionVariables;
};

export function FlowVariablesPanel({ variables }: FlowVariablesPanelProps) {
  const variableEntries = Object.entries(variables);

  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-950">Variables</h2>

      {variableEntries.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">Sin variables todavía.</p>
      ) : (
        <dl className="mt-3 space-y-2 text-sm">
          {variableEntries.map(([name, value]) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2"
            >
              <dt className="font-medium text-neutral-900">{name}</dt>
              <dd className="font-mono text-neutral-700">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
