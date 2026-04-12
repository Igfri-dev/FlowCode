import type { FlowExecutionState } from "@/features/flow/execution";

type FlowExecutionPanelProps = {
  executionState: FlowExecutionState;
  isAutoRunning: boolean;
  onStep: () => void;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
};

export function FlowExecutionPanel({
  executionState,
  isAutoRunning,
  onStep,
  onRun,
  onPause,
  onReset,
}: FlowExecutionPanelProps) {
  const cannotContinue =
    executionState.status === "finished" ||
    executionState.status === "error" ||
    executionState.status === "waitingInput";

  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-950">Ejecución</h2>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onStep}
          disabled={cannotContinue || isAutoRunning}
          className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          Ejecutar paso
        </button>
        <button
          type="button"
          onClick={isAutoRunning ? onPause : onRun}
          disabled={cannotContinue && !isAutoRunning}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          {isAutoRunning ? "Pausar" : "Ejecutar automático"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="col-span-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
        >
          Reset
        </button>
      </div>

      <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
        {executionState.message}
      </p>

      <p className="mt-3 text-xs font-medium text-neutral-500">
        Paso {executionState.stepCount} de {executionState.maxSteps}
      </p>
    </section>
  );
}
