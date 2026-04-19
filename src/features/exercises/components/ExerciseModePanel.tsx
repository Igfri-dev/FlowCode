import type { Exercise, ExerciseDifficulty } from "@/features/exercises/types";
import { useI18n } from "@/features/i18n/I18nProvider";

type ExerciseModePanelProps = {
  exercises: Exercise[];
  selectedExercise: Exercise | null;
  onSelectExercise: (exerciseId: string) => void;
};

export function ExerciseModePanel({
  exercises,
  selectedExercise,
  onSelectExercise,
}: ExerciseModePanelProps) {
  const { t } = useI18n();
  const localizedDifficultyLabels: Record<ExerciseDifficulty, string> = {
    facil: t("difficulty.facil"),
    media: t("difficulty.media"),
    dificil: t("difficulty.dificil"),
  };

  return (
    <section className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch">
      <div className="min-w-0 rounded-md border border-neutral-300/80 bg-white p-3 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50 sm:w-72 sm:shrink-0">
        <label
          className="block text-sm font-semibold text-neutral-950"
          htmlFor="exercise-mode-select"
        >
          {t("exercise.mode")}
        </label>
        <p className="mt-1 text-xs text-neutral-600">
          {t("exercise.modeHelp")}
        </p>
        <select
          id="exercise-mode-select"
          className="mt-3 w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-950 outline-none transition hover:border-neutral-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
          value={selectedExercise?.id ?? ""}
          onChange={(event) => onSelectExercise(event.target.value)}
        >
          <option value="" disabled>
            {t("exercise.select")}
          </option>
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.title} - {localizedDifficultyLabels[exercise.difficulty]}
            </option>
          ))}
        </select>
      </div>

      {selectedExercise ? (
        <article className="min-w-0 flex-1 rounded-md border border-emerald-300 bg-white p-3 shadow-md shadow-emerald-100/70 transition hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-emerald-500 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              {t("exercise.active")}
            </span>
            <p className="text-sm font-semibold text-neutral-950">
              {selectedExercise.title}
            </p>
            <span className="rounded border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-xs font-semibold text-neutral-700">
              {localizedDifficultyLabels[selectedExercise.difficulty]}
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-700">
            {selectedExercise.description}
          </p>
          <p className="mt-2 text-sm text-neutral-950">
            <span className="font-semibold">{t("exercise.objective")} </span>
            {selectedExercise.objective}
          </p>
          {selectedExercise.tags && selectedExercise.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedExercise.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ) : (
        <p className="min-w-0 flex-1 rounded-md border border-neutral-300/80 bg-white px-3 py-3 text-sm text-neutral-600 shadow-md shadow-neutral-200/70">
          {t("exercise.empty")}
        </p>
      )}
    </section>
  );
}
