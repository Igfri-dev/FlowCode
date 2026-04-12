import type { FlowFunctionDefinition } from "@/types/flow";

type FlowFunctionPanelProps = {
  activeDiagramId: string;
  functions: FlowFunctionDefinition[];
  onSelectDiagram: (diagramId: string) => void;
  onCreateFunction: () => void;
  onUpdateFunction: (
    functionId: string,
    changes: Pick<FlowFunctionDefinition, "name" | "parameters">,
  ) => void;
};

export function FlowFunctionPanel({
  activeDiagramId,
  functions,
  onSelectDiagram,
  onCreateFunction,
  onUpdateFunction,
}: FlowFunctionPanelProps) {
  const activeFunction = functions.find(
    (flowFunction) => flowFunction.id === activeDiagramId,
  );

  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-neutral-950">Funciones</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Edita el flujo principal o un subflujo reutilizable.
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onSelectDiagram("main")}
          className={getDiagramButtonClassName(activeDiagramId === "main")}
        >
          Principal
        </button>

        {functions.map((flowFunction) => (
          <button
            key={flowFunction.id}
            type="button"
            onClick={() => onSelectDiagram(flowFunction.id)}
            className={getDiagramButtonClassName(
              activeDiagramId === flowFunction.id,
            )}
          >
            {flowFunction.name}
          </button>
        ))}

        <button
          type="button"
          onClick={onCreateFunction}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
        >
          Nueva funcion
        </button>
      </div>

      {activeFunction ? (
        <div className="mt-4 space-y-2 rounded-md border border-violet-200 bg-violet-50 p-3">
          <label className="block text-xs font-semibold text-violet-950">
            Nombre
            <input
              className="mt-1 w-full rounded border border-violet-200 bg-white px-2 py-1 text-sm font-medium text-violet-950 outline-none focus:border-violet-500"
              value={activeFunction.name}
              onChange={(event) =>
                onUpdateFunction(activeFunction.id, {
                  name: event.target.value,
                  parameters: activeFunction.parameters,
                })
              }
            />
          </label>
          <label className="block text-xs font-semibold text-violet-950">
            Parametros
            <input
              className="mt-1 w-full rounded border border-violet-200 bg-white px-2 py-1 text-sm font-mono text-violet-950 outline-none focus:border-violet-500"
              value={activeFunction.parameters.join(", ")}
              onChange={(event) =>
                onUpdateFunction(activeFunction.id, {
                  name: activeFunction.name,
                  parameters: splitParameters(event.target.value),
                })
              }
              placeholder="a, b"
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}

function getDiagramButtonClassName(isActive: boolean) {
  return isActive
    ? "rounded-md border border-violet-500 bg-violet-50 px-3 py-2 text-left text-sm font-semibold text-violet-950"
    : "rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 transition hover:bg-neutral-50";
}

function splitParameters(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
