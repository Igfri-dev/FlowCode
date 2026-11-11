import type { Language } from "@/features/i18n/translations";
import type {
  ExerciseTestCase,
  ExerciseTestRunCaseResult,
} from "@/lib/flow-test-runner";

export function FlowTestResultDetails({
  cases,
  language,
  testCases,
}: {
  cases: ExerciseTestRunCaseResult[];
  language: Language;
  testCases?: ExerciseTestCase[];
}) {
  const es = language === "es";

  return (
    <div className="mt-3 space-y-2">
      {cases.map((testCase, index) => (
        <details
          key={`${testCase.name}-${index}`}
          className={`rounded-md border p-3 text-sm ${testCase.passed ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`}
        >
          <summary className="cursor-pointer font-semibold text-neutral-950">
            {testCase.name} ·{" "}
            {testCase.passed
              ? es
                ? "Aprobado"
                : "Passed"
              : es
                ? "Falló"
                : "Failed"}
          </summary>
          {!testCase.passed ? (
            <p className="mt-2 whitespace-pre-wrap text-red-900">
              {localizeTestMessage(testCase.message, language)}
            </p>
          ) : null}
          {testCases?.[index] ? (
            <div className="mt-3">
              <p className="font-medium text-neutral-700">
                {es ? "Entradas" : "Inputs"}
              </p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-xs text-neutral-900">
                {testCases[index].inputs?.length
                  ? testCases[index].inputs
                      .map((value) => JSON.stringify(value) ?? "undefined")
                      .join("\n")
                  : es
                    ? "Sin entradas"
                    : "No inputs"}
              </pre>
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <OutputValues
              label={es ? "Salida esperada" : "Expected output"}
              values={testCase.expectedOutputs}
              language={language}
            />
            <OutputValues
              label={es ? "Salida obtenida" : "Actual output"}
              values={testCase.actualOutputs}
              language={language}
            />
          </div>
        </details>
      ))}
    </div>
  );
}

function OutputValues({
  label,
  values,
  language,
}: {
  label: string;
  values: string[];
  language: Language;
}) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-neutral-700">{label}</p>
      <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-xs text-neutral-900">
        {values.length
          ? values.map((value) => JSON.stringify(value)).join("\n")
          : language === "es"
            ? "Sin salida"
            : "No output"}
      </pre>
    </div>
  );
}

function localizeTestMessage(message: string, language: Language) {
  if (language !== "es") return message;
  const messages: Record<string, string> = {
    "Missing input value for this test case.":
      "Falta un valor de entrada para este caso de prueba.",
    "Tests can only run the main diagram automatically.":
      "Las pruebas deben comenzar en el diagrama principal, con los argumentos de las funciones definidos.",
    "Output does not match the expected output.":
      "La salida obtenida no coincide con la esperada.",
    "Outputs do not match the expected outputs.":
      "La salida obtenida no coincide con la esperada.",
  };
  return messages[message] ?? message;
}
