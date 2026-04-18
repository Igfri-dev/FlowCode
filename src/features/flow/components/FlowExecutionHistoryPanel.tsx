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
  const latestFirstHistory = [...history].reverse();

  return (
    <section className="rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-950">
          Historial
        </h2>
        {history.length > 0 ? (
          <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-600">
            Reciente primero
          </span>
        ) : null}
      </div>

      {history.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          Ejecuta un paso para ver el recorrido.
        </p>
      ) : (
        <ol className="mt-3 max-h-110 space-y-2 overflow-y-auto pr-1 text-sm">
          {latestFirstHistory.map((item, index) => (
            <li
              key={item.id}
              className={`rounded-md border px-3 py-2 transition-colors ${
                index === 0
                  ? "border-emerald-300 bg-emerald-50/80"
                  : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-neutral-900">
                  {item.step}. {nodeTypeLabels[item.nodeType]}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {index === 0 ? (
                    <span className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                      Ultimo
                    </span>
                  ) : null}
                  {item.branchLabel ? (
                    <span className="rounded-md bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-900">
                      Rama {item.branchLabel}
                    </span>
                  ) : null}
                </span>
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
