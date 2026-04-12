import type { FlowExecutionOutputItem } from "@/features/flow/execution";

type FlowOutputPanelProps = {
  outputs: FlowExecutionOutputItem[];
};

export function FlowOutputPanel({ outputs }: FlowOutputPanelProps) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-950">Salidas</h2>

      {outputs.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          Las salidas apareceran durante la ejecucion.
        </p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          {outputs.map((output) => (
            <li
              key={output.id}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
            >
              <span className="text-xs font-semibold text-amber-800">
                Paso {output.step}
              </span>
              <p className="mt-1 font-mono text-amber-950">
                {output.content}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
