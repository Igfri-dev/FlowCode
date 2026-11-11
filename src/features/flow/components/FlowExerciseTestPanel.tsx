"use client";

import { useEffect, useState } from "react";
import type { Exercise } from "@/features/exercises/types";
import { useI18n } from "@/features/i18n/I18nProvider";
import {
  type ExerciseTestCase,
  type ExerciseTestRunCaseResult,
  runFlowProgramTests,
} from "@/lib/flow-test-runner";
import type { FlowProgram } from "@/types/flow";
import { FlowTestResultDetails } from "./FlowTestResultDetails";

type TestRequest = {
  signature: string;
  program: FlowProgram;
  testCases: ExerciseTestCase[];
};

type TestProgress = {
  signature: string;
  running: boolean;
  cases: ExerciseTestRunCaseResult[];
  error?: string;
};

export function FlowExerciseTestPanel({
  currentProgram,
  selectedExercise,
}: {
  currentProgram: FlowProgram;
  selectedExercise: Exercise | null;
}) {
  const { language } = useI18n();
  const es = language === "es";
  const [request, setRequest] = useState<TestRequest | null>(null);
  const [progress, setProgress] = useState<TestProgress | null>(null);
  const testCases = selectedExercise?.testCases ?? [];
  const signature = JSON.stringify({
    exerciseId: selectedExercise?.id,
    testCases,
    program: getExecutableProgram(currentProgram),
  });

  useEffect(() => {
    if (!request) return;
    if (request.signature !== signature) {
      setRequest(null);
      return;
    }

    let cancelled = false;
    let caseIndex = 0;
    const cases: ExerciseTestRunCaseResult[] = [];
    let timer: number;

    function runNextCase() {
      if (cancelled || !request) return;
      try {
        const testCase = request.testCases[caseIndex];
        const result = runFlowProgramTests({
          program: request.program,
          testCases: [
            { ...testCase, name: testCase.name || `#${caseIndex + 1}` },
          ],
        });
        cases.push(result.cases[0]);
        caseIndex += 1;
        setProgress({
          signature: request.signature,
          running: caseIndex < request.testCases.length,
          cases: [...cases],
        });
        if (caseIndex < request.testCases.length) {
          timer = window.setTimeout(runNextCase, 16);
        } else {
          setRequest(null);
        }
      } catch (error) {
        setProgress({
          signature: request.signature,
          running: false,
          cases: [...cases],
          error: error instanceof Error ? error.message : String(error),
        });
        setRequest(null);
      }
    }

    // Let the browser paint the running state and remain responsive between cases.
    timer = window.setTimeout(runNextCase, 16);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [request, signature]);

  if (testCases.length === 0) return null;

  const visibleProgress = progress?.signature === signature ? progress : null;
  const running = visibleProgress?.running ?? false;
  const passedCount =
    visibleProgress?.cases.filter((testCase) => testCase.passed).length ?? 0;

  function handleRunTests() {
    setProgress({ signature, running: true, cases: [] });
    setRequest({ signature, program: currentProgram, testCases });
  }

  return (
    <section
      className="rounded-lg border border-blue-200 bg-white p-4 shadow-md shadow-neutral-200/70"
      aria-busy={running}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">
            {es ? "Prueba tu solución" : "Test your solution"}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {es
              ? "Comprueba los casos del ejercicio antes de entregar. Las pruebas no envían tu trabajo al profesor."
              : "Check the exercise cases before submitting. Running tests does not submit your work."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunTests}
          disabled={running}
          className="rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {running
            ? es
              ? "Probando…"
              : "Testing…"
            : es
              ? "Probar solución"
              : "Test solution"}
        </button>
      </div>
      <div aria-live="polite" className="mt-3 text-sm text-neutral-700">
        {visibleProgress ? (
          <p>
            {running
              ? es
                ? `Comprobando ${visibleProgress.cases.length} de ${testCases.length} casos…`
                : `Checked ${visibleProgress.cases.length} of ${testCases.length} cases…`
              : es
                ? `${passedCount} de ${testCases.length} casos aprobados.`
                : `${passedCount} of ${testCases.length} cases passed.`}
          </p>
        ) : progress ? (
          <p>
            {es
              ? "El diagrama o el ejercicio cambió. Vuelve a probar la solución para actualizar los resultados."
              : "The diagram or exercise changed. Test the solution again to update the results."}
          </p>
        ) : (
          <p>
            {es
              ? `${testCases.length} casos disponibles.`
              : `${testCases.length} cases available.`}
          </p>
        )}
        {visibleProgress?.error ? (
          <p className="mt-2 whitespace-pre-wrap text-red-800">
            {es
              ? "No se pudieron completar las pruebas: "
              : "The tests could not be completed: "}
            {visibleProgress.error}
          </p>
        ) : null}
      </div>
      {visibleProgress ? (
        <FlowTestResultDetails
          cases={visibleProgress.cases}
          testCases={testCases}
          language={language}
        />
      ) : null}
    </section>
  );
}

// Canvas selection, measurements, and position changes do not affect test results.
function getExecutableProgram(program: FlowProgram) {
  function diagram(value: FlowProgram["main"]) {
    return {
      nodes: value.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        config: node.data.config,
      })),
      edges: value.edges.map(
        ({ source, target, sourceHandle, targetHandle }) => ({
          source,
          target,
          sourceHandle,
          targetHandle,
        }),
      ),
    };
  }
  return {
    main: diagram(program.main),
    functions: program.functions.map((flowFunction) => ({
      id: flowFunction.id,
      name: flowFunction.name,
      parameters: flowFunction.parameters,
      parameterDefinitions: flowFunction.parameterDefinitions,
      ...diagram(flowFunction),
    })),
  };
}
