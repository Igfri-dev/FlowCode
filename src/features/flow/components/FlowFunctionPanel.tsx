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
    <section className="workspace-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-950/[0.025]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {t("flow.functions")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t("flow.functionsHelp")}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 font-mono text-xs font-medium text-teal-700"
        >
          ƒ
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          aria-pressed={activeDiagramId === "main"}
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
                  ? "rounded-xl border border-teal-200 bg-teal-50/60 p-2"
                  : "flex items-stretch gap-1"
              }
            >
              <div className="flex w-full min-w-0 items-stretch gap-1">
                {isActive ? (
                  <div className="flex min-h-9 min-w-0 flex-1 items-center px-2">
                    {isEditingName ? (
                      <input
                        autoFocus
                        className="h-9 w-full min-w-0 rounded-lg border border-teal-200 bg-white px-2 text-xs font-semibold text-teal-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                        aria-label={t("flow.editFunctionNameAria", {
                          name: flowFunction.name,
                        })}
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
                        aria-pressed="true"
                        className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-50"
                      >
                        {flowFunction.name}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-pressed="false"
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
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80 text-slate-600 transition-colors hover:bg-white hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-50"
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                >
                  ×
                </button>
              </div>

              {isActive ? (
                <label className="mt-2 block px-2 pb-1 text-[10px] font-medium text-teal-800">
                  {t("flow.parameters")}
                  <input
                    className="mt-1 h-9 w-full rounded-lg border border-teal-200/80 bg-white px-2 font-mono text-xs text-teal-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
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
          className="min-h-9 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2 text-left text-xs font-medium text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          {t("flow.newFunction")}
        </button>
      </div>
    </section>
  );
}

function getDiagramButtonClassName(isActive: boolean) {
  return isActive
    ? "min-h-9 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-left text-xs font-semibold text-teal-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
    : "min-h-9 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2";
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
