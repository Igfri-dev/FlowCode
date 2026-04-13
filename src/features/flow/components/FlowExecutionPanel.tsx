import type { ReactNode } from "react";
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
    <div
      aria-label="Controles de ejecucion"
      className="flex min-w-0 flex-wrap items-center justify-end gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1"
    >
      <span
        className="hidden max-w-44 truncate text-xs font-medium text-neutral-600 md:inline"
        title={executionState.message}
      >
        {executionState.message}
      </span>
      <span className="whitespace-nowrap text-xs font-medium text-neutral-500">
        Paso {executionState.stepCount} de {executionState.maxSteps}
      </span>

      <div className="flex items-center gap-1">
        <IconButton
          label="Ejecutar paso"
          onClick={onStep}
          disabled={cannotContinue || isAutoRunning}
          variant="primary"
        >
          <StepIcon />
        </IconButton>
        <IconButton
          label={isAutoRunning ? "Pausar" : "Ejecutar automatico"}
          onClick={isAutoRunning ? onPause : onRun}
          disabled={cannotContinue && !isAutoRunning}
          variant="secondary"
        >
          {isAutoRunning ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton label="Reiniciar" onClick={onReset} variant="secondary">
          <ResetIcon />
        </IconButton>
      </div>
    </div>
  );
}

type IconButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary";
};

function IconButton({
  children,
  disabled = false,
  label,
  onClick,
  variant,
}: IconButtonProps) {
  const variantClassName =
    variant === "primary"
      ? "border-neutral-950 bg-neutral-950 text-white hover:-translate-y-0.5 hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-sm focus-visible:ring-neutral-500 disabled:border-neutral-300 disabled:bg-neutral-300 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      : "border-neutral-300 bg-white text-neutral-800 hover:-translate-y-0.5 hover:border-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 hover:shadow-sm focus-visible:ring-neutral-500 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:hover:translate-y-0 disabled:hover:border-neutral-300 disabled:hover:shadow-none";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed ${variantClassName}`}
    >
      {children}
    </button>
  );
}

function StepIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6 5l9 7-9 7V5zM18 5v14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="M8 5l11 7-11 7V5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M8 5v14M16 5v14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 7v5h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M5.5 12a6.5 6.5 0 1 0 1.9-4.6L4 10.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
