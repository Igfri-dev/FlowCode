import {
  resetFlowExecution,
  resumeFlowExecutionWithInput,
  stepFlowExecution,
  type ExecutionValue,
  type FlowExecutionState,
} from "@/features/flow/execution";
import type { FlowProgram } from "@/types/flow";

export type ExerciseTestCase = {
  name?: string;
  inputs?: ExecutionValue[];
  expectedOutputs: string[];
};

export type ExerciseTestRunCaseResult = {
  name: string;
  passed: boolean;
  expectedOutputs: string[];
  actualOutputs: string[];
  message: string;
};

export type ExerciseTestRunResult = {
  passed: boolean;
  total: number;
  passedCount: number;
  cases: ExerciseTestRunCaseResult[];
};

export function parseExerciseTestCases(value: string | null) {
  if (!value?.trim()) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Exercise tests must be a JSON array.");
  }

  return parsed.map((item, index): ExerciseTestCase => {
    if (!isRecord(item) || !Array.isArray(item.expectedOutputs)) {
      throw new Error(`Test case ${index + 1} needs expectedOutputs.`);
    }

    return {
      name: typeof item.name === "string" ? item.name : `Case ${index + 1}`,
      inputs: Array.isArray(item.inputs)
        ? item.inputs.map(normalizeExecutionValue)
        : [],
      expectedOutputs: item.expectedOutputs.map((output) => String(output)),
    };
  });
}

export function runFlowProgramTests({
  maxSteps = 1000,
  program,
  testCases,
}: {
  maxSteps?: number;
  program: FlowProgram;
  testCases: ExerciseTestCase[];
}): ExerciseTestRunResult {
  const cases = testCases.map((testCase, index) =>
    runSingleTestCase({
      maxSteps,
      name: testCase.name || `Case ${index + 1}`,
      program,
      testCase,
    }),
  );
  const passedCount = cases.filter((testCase) => testCase.passed).length;

  return {
    passed: cases.length > 0 && passedCount === cases.length,
    total: cases.length,
    passedCount,
    cases,
  };
}

function runSingleTestCase({
  maxSteps,
  name,
  program,
  testCase,
}: {
  maxSteps: number;
  name: string;
  program: FlowProgram;
  testCase: ExerciseTestCase;
}): ExerciseTestRunCaseResult {
  let state: FlowExecutionState = {
    ...resetFlowExecution("main", "Principal"),
    maxSteps,
  };
  const inputs = [...(testCase.inputs ?? [])];

  while (state.status !== "finished" && state.status !== "error") {
    state = stepFlowExecution({
      activeDiagramId: "main",
      program,
      state,
    });

    if (state.status === "waitingInput") {
      if (inputs.length === 0) {
        return createFailedCase({
          actualOutputs: state.outputs.map((output) => output.content),
          expectedOutputs: testCase.expectedOutputs,
          message: "Missing input value for this test case.",
          name,
        });
      }

      state = resumeFlowExecutionWithInput({
        state,
        value: inputs.shift(),
      });
    }

    if (state.status === "waitingFunctionParameters") {
      return createFailedCase({
        actualOutputs: state.outputs.map((output) => output.content),
        expectedOutputs: testCase.expectedOutputs,
        message: "Tests can only run the main diagram automatically.",
        name,
      });
    }
  }

  const actualOutputs = state.outputs.map((output) => output.content);
  const passed = areOutputsEqual(actualOutputs, testCase.expectedOutputs);

  return {
    name,
    passed,
    actualOutputs,
    expectedOutputs: testCase.expectedOutputs,
    message: passed ? "Passed" : state.message,
  };
}

function createFailedCase({
  actualOutputs,
  expectedOutputs,
  message,
  name,
}: {
  actualOutputs: string[];
  expectedOutputs: string[];
  message: string;
  name: string;
}): ExerciseTestRunCaseResult {
  return {
    name,
    passed: false,
    actualOutputs,
    expectedOutputs,
    message,
  };
}

function areOutputsEqual(actual: string[], expected: string[]) {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function normalizeExecutionValue(value: unknown): ExecutionValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeExecutionValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        normalizeExecutionValue(entry),
      ]),
    );
  }

  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
