import type { Exercise, ExerciseDifficulty } from "@/features/exercises/types";
import { useI18n } from "@/features/i18n/I18nProvider";

type ExerciseModePanelProps = {
  exercises: Exercise[];
  selectedExercise: Exercise | null;
  onSelectExercise: (exerciseId: string) => void;
  showExerciseSelector?: boolean;
};

export function ExerciseModePanel({
  exercises,
  selectedExercise,
  onSelectExercise,
  showExerciseSelector = true,
}: ExerciseModePanelProps) {
  const { language, t } = useI18n();
  const localizedDifficultyLabels: Record<ExerciseDifficulty, string> = {
    facil: t("difficulty.facil"),
    media: t("difficulty.media"),
    dificil: t("difficulty.dificil"),
  };

  return (
    <section
      data-panel="exercise-selector"
      className="workspace-panel !p-0 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.04]"
    >
      <header className="flex items-center gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5.5C9 3.5 5.5 3.5 3 4v15c3-.6 6-.2 9 1.5 3-1.7 6-2.1 9-1.5V4c-2.5-.5-6-.5-9 1.5ZM12 5.5v15" />
          </svg>
        </span>
        {showExerciseSelector ? (
          <label
            className="text-sm font-semibold tracking-tight text-slate-900"
            htmlFor="exercise-mode-select"
          >
            {t("exercise.mode")}
          </label>
        ) : (
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {language === "es" ? "Ejercicio" : "Exercise"}
          </h2>
        )}
      </header>
      <div className="px-4 py-3">
        {showExerciseSelector ? (
          <div className="relative min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-inner shadow-slate-100/70 transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10">
            <select
              id="exercise-mode-select"
              className="min-h-10 w-full min-w-0 appearance-none rounded-lg border-0 bg-white py-2.5 pl-3 pr-10 text-xs font-medium text-slate-800 outline-none"
              title={t("exercise.modeHelp")}
              value={selectedExercise?.id ?? ""}
              onChange={(event) => onSelectExercise(event.target.value)}
            >
              <option value="" disabled>
                {t("exercise.select")}
              </option>
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.title} -{" "}
                  {localizedDifficultyLabels[exercise.difficulty]}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="m6 8 4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : null}

        {selectedExercise ? (
          <details
            key={selectedExercise.id}
            className={`group ${showExerciseSelector ? "mt-3 border-t border-slate-100 pt-3" : ""}`}
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-xs [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-teal-500"
                  aria-hidden="true"
                />
                <span className="font-semibold text-slate-700">
                  {showExerciseSelector
                    ? language === "es"
                      ? "Instrucciones del ejercicio"
                      : "Exercise instructions"
                    : selectedExercise.title}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {localizedDifficultyLabels[selectedExercise.difficulty]}
                </span>
                <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                  {t("exercise.active")}
                </span>
              </span>
              <svg
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  d="m5 7.5 5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {selectedExercise.description}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-900">
              <span className="font-semibold">{t("exercise.objective")} </span>
              {selectedExercise.objective}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              <span className="font-medium text-slate-700">
                {t("exercise.deadline")}{" "}
              </span>
              {selectedExercise.submissionDeadline
                ? selectedExercise.submissionDeadline.replace("T", " ")
                : t("exercise.noDeadline")}
            </p>
            {selectedExercise.testCases &&
            selectedExercise.testCases.length > 0 ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t("exercise.expectedOutput")}
                </p>
                <div className="mt-2 grid gap-2">
                  {selectedExercise.testCases.map((testCase, index) => (
                    <div
                      key={`${testCase.name ?? "case"}-${index}`}
                      className="rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-xs text-slate-600"
                    >
                      <p className="font-semibold text-slate-800">
                        {testCase.name ?? `#${index + 1}`}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium">
                          {t("exercise.testInput")}:
                        </span>{" "}
                        {testCase.inputs && testCase.inputs.length > 0
                          ? testCase.inputs.map(formatTestValue).join(", ")
                          : t("exercise.noInput")}
                      </p>
                      <div className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-950 px-3 py-2 font-mono text-[11px] leading-5 text-emerald-300">
                        {testCase.expectedOutputs.length > 0
                          ? testCase.expectedOutputs.join("\n")
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {selectedExercise.tags && selectedExercise.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedExercise.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </details>
        ) : (
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {t("exercise.empty")}
          </p>
        )}
      </div>
    </section>
  );
}

function formatTestValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}
