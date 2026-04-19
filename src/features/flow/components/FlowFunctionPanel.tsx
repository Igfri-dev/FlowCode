import { useState } from "react";
import { useI18n } from "@/features/i18n/I18nProvider";
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
  const { t } = useI18n();
  const [parameterDrafts, setParameterDrafts] = useState<
    Record<string, string>
  >({});
  const [editingNameId, setEditingNameId] = useState<string | null>(null);

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
    if (editingNameId === functionId) {
      setEditingNameId(null);
    }

    setParameterDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[functionId];
      return nextDrafts;
    });
    onDeleteFunction(functionId);
  }

  function handleSelectFunction(flowFunction: FlowFunctionDefinition) {
    if (activeDiagramId !== flowFunction.id) {
      setEditingNameId(null);
    }

    onSelectDiagram(flowFunction.id);
  }

  function handleNameChange(
    flowFunction: FlowFunctionDefinition,
    value: string,
  ) {
    onUpdateFunction(flowFunction.id, {
      name: value,
      parameters: flowFunction.parameters,
    });
  }

  function handleCreateFunction() {
    setEditingNameId(null);
    onCreateFunction();
  }

  return (
    <section className="rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50">
      <div>
        <h2 className="text-base font-semibold text-neutral-950">
          {t("flow.functions")}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          {t("flow.functionsHelp")}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setEditingNameId(null);
            onSelectDiagram("main");
          }}
          className={getDiagramButtonClassName(activeDiagramId === "main")}
        >
          {t("flow.main")}
        </button>

        {functions.map((flowFunction) => {
          const isActive = activeDiagramId === flowFunction.id;
          const isEditingName = editingNameId === flowFunction.id;
          const parameterValue =
            parameterDrafts[flowFunction.id] ??
            flowFunction.parameters.join(", ");

          return (
            <div
              key={flowFunction.id}
              className={
                isActive
                  ? "rounded-md border border-violet-300 bg-violet-50/70 p-2 shadow-sm ring-1 ring-violet-100"
                  : "flex items-stretch gap-1"
              }
            >
              <div className="flex w-full min-w-0 items-stretch gap-1">
                {isActive ? (
                  <div className="flex min-h-9 min-w-0 flex-1 items-center px-2">
                    {isEditingName ? (
                      <input
                        autoFocus
                        className="w-full min-w-0 rounded-md border border-violet-200 bg-white px-2 py-1 text-sm font-semibold text-violet-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                        value={flowFunction.name}
                        onChange={(event) =>
                          handleNameChange(flowFunction, event.target.value)
                        }
                        onBlur={() => setEditingNameId(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === "Escape") {
                            event.currentTarget.blur();
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectFunction(flowFunction)}
                        className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-violet-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-50"
                      >
                        {flowFunction.name}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectFunction(flowFunction)}
                    className={`${getDiagramButtonClassName(false)} min-w-0 flex-1 truncate`}
                  >
                    {flowFunction.name}
                  </button>
                )}

                {isActive ? (
                  <button
                    type="button"
                    aria-label={t("flow.editFunctionNameAria", {
                      name: flowFunction.name,
                    })}
                    title={t("flow.editFunctionName")}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelectDiagram(flowFunction.id);
                      setEditingNameId(flowFunction.id);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-neutral-900 shadow-sm transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-50 active:translate-y-px"
                  >
                    <PencilIcon />
                  </button>
                ) : null}

                <button
                  type="button"
                  aria-label={t("flow.deleteFunctionAria", {
                    name: flowFunction.name,
                  })}
                  title={t("flow.deleteFunction")}
                  onClick={() => handleDeleteFunction(flowFunction.id)}
                  className="flex w-9 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-sm font-semibold text-red-700 transition-all hover:-translate-y-px hover:border-red-300 hover:bg-red-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-none"
                >
                  x
                </button>
              </div>

              {isActive ? (
                <label className="mt-2 block px-2 pb-1 text-xs font-semibold text-violet-950">
                  {t("flow.parameters")}
                  <input
                    className="mt-1 w-full rounded-md border border-violet-200 bg-white px-2 py-1 text-sm font-mono text-violet-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                    value={parameterValue}
                    onChange={(event) =>
                      handleParameterChange(flowFunction, event.target.value)
                    }
                    placeholder="a, b"
                  />
                </label>
              ) : null}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleCreateFunction}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-none"
        >
          {t("flow.newFunction")}
        </button>
      </div>
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

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5z" />
    </svg>
  );
}
