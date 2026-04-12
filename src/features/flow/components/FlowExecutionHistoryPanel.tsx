import type { FlowExecutionHistoryItem } from "@/features/flow/execution";

type FlowExecutionHistoryPanelProps = {
  history: FlowExecutionHistoryItem[];
};

const nodeTypeLabels: Record<FlowExecutionHistoryItem["nodeType"], string> = {
  start: "Inicio",
  end: "Fin",
  process: "Proceso",
  decision: "Decision",
  input: "Entrada",
  output: "Salida",
  functionCall: "Llamada",
  return: "Retorno",
};

export function FlowExecutionHistoryPanel({
  history,
}: FlowExecutionHistoryPanelProps) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-950">Historial</h2>

      {history.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          Ejecuta un paso para ver el recorrido.
        </p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          {history.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-neutral-900">
                  {item.step}. {nodeTypeLabels[item.nodeType]}
                </span>
                {item.branchLabel ? (
                  <span className="rounded-md bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-900">
                    Rama {item.branchLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs font-medium text-neutral-500">
                {item.diagramName}
              </p>
              <p className="mt-1 font-mono text-xs text-neutral-700">
                {item.content}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
