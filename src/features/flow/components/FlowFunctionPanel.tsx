import { useState } from "react";
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
  onDeleteFunction: (functionId: string) => void;
};

export function FlowFunctionPanel({
  activeDiagramId,
  functions,
  onSelectDiagram,
  onCreateFunction,
  onUpdateFunction,
  onDeleteFunction,
}: FlowFunctionPanelProps) {
  const [parameterDrafts, setParameterDrafts] = useState<
    Record<string, string>
  >({});
  const activeFunction = functions.find(
    (flowFunction) => flowFunction.id === activeDiagramId,
  );
  const activeParameterValue = activeFunction
    ? (parameterDrafts[activeFunction.id] ??
      activeFunction.parameters.join(", "))
    : "";

  function handleParameterChange(
    flowFunction: FlowFunctionDefinition,
    value: string,
  ) {
    setParameterDrafts((currentDrafts) => ({
      ...currentDrafts,
      [flowFunction.id]: value,
    }));
    onUpdateFunction(flowFunction.id, {
      name: flowFunction.name,
      parameters: splitParameters(value),
    });
  }

  function handleDeleteFunction(functionId: string) {
    setParameterDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[functionId];
      return nextDrafts;
    });
    onDeleteFunction(functionId);
  }

  return (
    <section className="rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50">
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
          <div key={flowFunction.id} className="flex items-stretch gap-1">
            <button
              type="button"
              onClick={() => onSelectDiagram(flowFunction.id)}
              className={`${getDiagramButtonClassName(
                activeDiagramId === flowFunction.id,
              )} min-w-0 flex-1 truncate`}
            >
              {flowFunction.name}
            </button>
            <button
              type="button"
              aria-label={`Eliminar funcion ${flowFunction.name}`}
              title="Eliminar funcion"
              onClick={() => handleDeleteFunction(flowFunction.id)}
              className="flex w-9 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-sm font-semibold text-red-700 transition-all hover:-translate-y-px hover:border-red-300 hover:bg-red-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-none"
            >
              x
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onCreateFunction}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-none"
        >
          Nueva funcion
        </button>
      </div>

      {activeFunction ? (
        <div className="mt-4 space-y-2 rounded-md border border-violet-200 bg-violet-50/70 p-3">
          <label className="block text-xs font-semibold text-violet-950">
            Nombre
            <input
              className="mt-1 w-full rounded-md border border-violet-200 bg-white px-2 py-1 text-sm font-medium text-violet-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
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
              className="mt-1 w-full rounded-md border border-violet-200 bg-white px-2 py-1 text-sm font-mono text-violet-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
              value={activeParameterValue}
              onChange={(event) =>
                handleParameterChange(activeFunction, event.target.value)
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
    ? "rounded-md border border-violet-500 bg-violet-50 px-3 py-2 text-left text-sm font-semibold text-violet-950 shadow-sm ring-1 ring-violet-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
    : "rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-none";
}

function splitParameters(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
