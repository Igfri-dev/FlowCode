import { stepFlowExecution, type FlowExecutionState } from "./execution";
import type { FlowProgram } from "@/types/flow";

export function canContinueFlowExecution(state: FlowExecutionState) {
  return state.status === "idle" || state.status === "running";
}

// A batch yields frequently; these bounds never limit the complete execution.
export function runFlowExecutionBatch({
  program,
  activeDiagramId,
  state,
  timeBudgetMs = 8,
  now = () => performance.now(),
}: {
  program: FlowProgram;
  activeDiagramId: string;
  state: FlowExecutionState;
  timeBudgetMs?: number;
  now?: () => number;
}): FlowExecutionState {
  const started = now();
  let next = state;
  for (let step = 0; step < 4096 && canContinueFlowExecution(next); step++) {
    const previous = next;
    next = stepFlowExecution({ program, activeDiagramId, state: next });
    if (next === previous || now() - started >= timeBudgetMs) break;
  }
  return next;
}
