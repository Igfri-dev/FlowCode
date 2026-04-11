import type { FlowValidationIssue } from "@/features/flow/flow-validation";

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
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-950">Validación</h2>

      {issues.length === 0 ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          El diagrama no tiene problemas estructurales.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-900"
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {blockedConnectionMessage ? (
        <p className="mt-3 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          Conexión bloqueada: {blockedConnectionMessage}
        </p>
      ) : null}

      {hasLoops ? (
        <p className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
          Se detectó un bucle. Esto es válido y puede usarse para representar ciclos.
        </p>
      ) : null}
    </section>
  );
}
