import type { ReactNode } from "react";
import type { FlowExecutionState } from "@/features/flow/execution";
import { useI18n } from "@/features/i18n/I18nProvider";

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
  const { t } = useI18n();
  const localizedMessage = getLocalizedExecutionMessage(
    executionState.message,
    t,
  );
  const isVertical = layout === "vertical";
  const cannotContinue =
    executionState.status === "finished" ||
    executionState.status === "error" ||
    executionState.status === "waitingInput" ||
    executionState.status === "waitingFunctionParameters";
  const rootClassName = isVertical
    ? "workspace-panel flow-execution-controls flex min-w-0 flex-col items-stretch gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5"
    : "flow-execution-controls flex min-w-0 flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1.5";
  const messageClassName = isVertical
    ? "max-w-full truncate px-1 py-1 text-[11px] font-medium text-slate-500"
    : "hidden max-w-32 truncate px-1 py-1 text-[11px] font-medium text-slate-500 2xl:inline";
  const buttonGroupClassName = isVertical
    ? "grid grid-cols-3 gap-1.5"
    : "flex items-center gap-1";

  return (
    <div aria-label={t("flow.executionControls")} className={rootClassName}>
      <span className={messageClassName} title={localizedMessage}>
        {localizedMessage}
      </span>
      <span className="whitespace-nowrap px-1 font-mono text-[10px] text-slate-400">
        {t("flow.stepOf", {
          max: executionState.maxSteps,
          step: executionState.stepCount,
        })}
      </span>

      <div className={buttonGroupClassName}>
        <IconButton
          label={t("flow.stepAction")}
          onClick={onStep}
          disabled={cannotContinue || isAutoRunning}
          variant="secondary"
          wide={isVertical}
        >
          <StepIcon />
        </IconButton>
        <IconButton
          label={isAutoRunning ? t("flow.pause") : t("flow.run")}
          onClick={isAutoRunning ? onPause : onRun}
          disabled={cannotContinue && !isAutoRunning}
          variant="primary"
          wide={isVertical}
        >
          {isAutoRunning ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton
          label={t("flow.reset")}
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

function getLocalizedExecutionMessage(
  message: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (message === "Listo para ejecutar.") {
    return t("execution.ready");
  }

  if (message === "Ejecucion reiniciada.") {
    return t("execution.reset");
  }

  if (message === "Ejecucion finalizada.") {
    return t("execution.finished");
  }

  if (message === "Inicio.") {
    return t("execution.started");
  }

  return message;
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
      ? "border-teal-700 bg-teal-700 text-white hover:border-teal-800 hover:bg-teal-800 focus-visible:ring-teal-500 disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-teal-500 disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300";
  const sizeClassName = wide ? "h-9 w-full" : "h-9 w-9";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${sizeClassName} ${variantClassName}`}
    >
      {children}
    </button>
  );
}

function StepIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
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
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M8 5l11 7-11 7V5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
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
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
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
