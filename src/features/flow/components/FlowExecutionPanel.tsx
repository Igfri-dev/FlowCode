import type { ReactNode } from "react";
import type { FlowExecutionState } from "@/features/flow/execution";

type FlowExecutionPanelProps = {
  executionState: FlowExecutionState;
  isAutoRunning: boolean;
  layout?: "inline" | "vertical";
  onStep: () => void;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
};

export function FlowExecutionPanel({
  executionState,
  isAutoRunning,
  layout = "inline",
  onStep,
  onRun,
  onPause,
  onReset,
}: FlowExecutionPanelProps) {
  const isVertical = layout === "vertical";
  const cannotContinue =
    executionState.status === "finished" ||
    executionState.status === "error" ||
    executionState.status === "waitingInput" ||
    executionState.status === "waitingFunctionParameters";
  const rootClassName = isVertical
    ? "flex min-w-0 flex-col items-stretch gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2 shadow-sm"
    : "flex min-w-0 flex-wrap items-center justify-end gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 shadow-sm";
  const messageClassName = isVertical
    ? "max-w-full truncate rounded-md bg-white px-2 py-1 text-xs font-medium text-neutral-600 shadow-sm"
    : "hidden max-w-44 truncate rounded-md bg-white px-2 py-1 text-xs font-medium text-neutral-600 shadow-sm md:inline";
  const buttonGroupClassName = isVertical
    ? "grid grid-cols-3 gap-1.5"
    : "flex items-center gap-1";

  return (
    <div
      aria-label="Controles de ejecucion"
      className={rootClassName}
    >
      <span
        className={messageClassName}
        title={executionState.message}
      >
        {executionState.message}
      </span>
      <span className="whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-500">
        Paso {executionState.stepCount} de {executionState.maxSteps}
      </span>

      <div className={buttonGroupClassName}>
        <IconButton
          label="Ejecutar paso"
          onClick={onStep}
          disabled={cannotContinue || isAutoRunning}
          variant="primary"
          wide={isVertical}
        >
          <StepIcon />
        </IconButton>
        <IconButton
          label={isAutoRunning ? "Pausar" : "Ejecutar automatico"}
          onClick={isAutoRunning ? onPause : onRun}
          disabled={cannotContinue && !isAutoRunning}
          variant="secondary"
          wide={isVertical}
        >
          {isAutoRunning ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton
          label="Reiniciar"
          onClick={onReset}
          variant="secondary"
          wide={isVertical}
        >
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
  wide?: boolean;
};

function IconButton({
  children,
  disabled = false,
  label,
  onClick,
  variant,
  wide = false,
}: IconButtonProps) {
  const variantClassName =
    variant === "primary"
      ? "border-neutral-950 bg-neutral-950 text-white hover:-translate-y-0.5 hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-sm focus-visible:ring-neutral-500 disabled:border-neutral-300 disabled:bg-neutral-300 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      : "border-neutral-300 bg-white text-neutral-800 hover:-translate-y-0.5 hover:border-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 hover:shadow-sm focus-visible:ring-neutral-500 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:hover:translate-y-0 disabled:hover:border-neutral-300 disabled:hover:shadow-none";
  const sizeClassName = wide ? "h-9 w-full" : "h-8 w-8";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed ${sizeClassName} ${variantClassName}`}
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
