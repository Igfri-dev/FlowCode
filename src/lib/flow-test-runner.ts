import {
  resetFlowExecution,
  resumeFlowExecutionWithInput,
  stepFlowExecution,
  type ExecutionValue,
  type FlowExecutionState,
} from "@/features/flow/execution";
import type { FlowProgram } from "@/types/flow";
import {
  evaluateFlowTechniques,
  exerciseTechniques,
  type ExerciseTechnique,
  type TechniqueCheck,
  type TechniqueExecutionStep,
} from "@/lib/flow-technique-validation";

export type ExerciseTestCase = {
  name?: string;
  inputs?: ExecutionValue[];
  expectedOutputs: string[];
  requirements?: ExerciseTechnique[];
};

export type ExerciseTestRunCaseResult = {
  name: string;
  passed: boolean;
  expectedOutputs: string[];
  actualOutputs: string[];
  message: string;
  outputsPassed?: boolean;
  techniqueResults?: TechniqueCheck[];
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
      ...(item.requirements !== undefined
        ? { requirements: parseRequirements(item.requirements, index) }
        : {}),
    };
  });
}

function parseRequirements(value: unknown, index: number): ExerciseTechnique[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        typeof item !== "string" ||
        !exerciseTechniques.includes(item as ExerciseTechnique),
    )
  ) {
    throw new Error(
      `Test case ${index + 1} has invalid technique requirements. Allowed: ${exerciseTechniques.join(", ")}.`,
    );
  }
  return [...new Set(value)] as ExerciseTechnique[];
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
  if (!Number.isSafeInteger(maxSteps) || maxSteps <= 0) {
    throw new RangeError("maxSteps must be a positive safe integer.");
  }

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
  const trace: TechniqueExecutionStep[] = [];
  const requirements = testCase.requirements ?? [];

  while (state.status !== "finished" && state.status !== "error") {
    const before = state;
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
          requirements,
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
        requirements,
      });
    }

    if (requirements.length > 0 && state.stepCount > before.stepCount) {
      const executed = state.history.at(-1);
      if (executed) {
        trace.push({
          diagramId: before.currentDiagramId,
          nodeId: executed.nodeId,
          variablesBefore: before.variables,
          variablesAfter: state.variables,
        });
      }
    }
  }

  const actualOutputs = state.outputs.map((output) => output.content);
  const outputsPassed = areOutputsEqual(
    actualOutputs,
    testCase.expectedOutputs,
  );
  const techniqueEvaluation = evaluateFlowTechniques({
    program,
    trace,
    requirements,
  });
  const passed =
    state.status === "finished" && outputsPassed && techniqueEvaluation.passed;

  return {
    name,
    passed,
    actualOutputs,
    expectedOutputs: testCase.expectedOutputs,
    outputsPassed,
    techniqueResults: techniqueEvaluation.checks,
    message: passed
      ? "Passed"
      : state.status === "error"
        ? state.message
        : !outputsPassed
          ? "Outputs do not match the expected outputs."
          : "Outputs match, but required techniques were not demonstrated.",
  };
}

function createFailedCase({
  actualOutputs,
  expectedOutputs,
  message,
  name,
  requirements = [],
}: {
  actualOutputs: string[];
  expectedOutputs: string[];
  message: string;
  name: string;
  requirements?: ExerciseTechnique[];
}): ExerciseTestRunCaseResult {
  return {
    name,
    passed: false,
    actualOutputs,
    expectedOutputs,
    message,
    outputsPassed: areOutputsEqual(actualOutputs, expectedOutputs),
    techniqueResults: requirements.map((technique) => ({
      technique,
      passed: false,
    })),
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
