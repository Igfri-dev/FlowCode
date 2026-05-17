import { useCallback, useMemo, type RefObject } from "react";
import { getExercises } from "@/features/exercises/data/exercises";
import type { Exercise, ExerciseStarterDiagram } from "@/features/exercises/types";
import type { Language } from "@/features/i18n/translations";
import type { FlowProgram } from "@/types/flow";
import { hasDiagramContent } from "./flowWorkspaceSerialization";

export function useFlowExerciseMode({
  currentProgram,
  language,
  loadedExerciseStarterCodeRef,
  loadStarterDiagram,
  databaseExercises,
  selectedExerciseId,
  requestReplaceConfirmation,
  resetCodeGeneration,
  setBlockedConnectionMessage,
  setIsAutoRunning,
  setSelectedExerciseId,
}: {
  currentProgram: FlowProgram;
  language: Language;
  loadedExerciseStarterCodeRef: RefObject<string | null>;
  loadStarterDiagram: (starterDiagram: ExerciseStarterDiagram) => void;
  databaseExercises: Exercise[];
  requestReplaceConfirmation: (onConfirm: () => void) => void;
  selectedExerciseId: string | null;
  resetCodeGeneration: () => void;
  setBlockedConnectionMessage: (message: string | null) => void;
  setIsAutoRunning: (isAutoRunning: boolean) => void;
  setSelectedExerciseId: (exerciseId: string | null) => void;
}) {
  const exerciseCatalog = useMemo(
    () => [...databaseExercises, ...getExercises(language)],
    [databaseExercises, language],
  );
  const selectedExercise = useMemo(
    () =>
      exerciseCatalog.find((exercise) => exercise.id === selectedExerciseId) ??
      null,
    [exerciseCatalog, selectedExerciseId],
  );

  const clearExerciseSelection = useCallback(() => {
    setSelectedExerciseId(null);
    loadedExerciseStarterCodeRef.current = null;
  }, [loadedExerciseStarterCodeRef, setSelectedExerciseId]);

  const handleSelectExercise = useCallback(
    (exerciseId: string) => {
      const exercise = exerciseCatalog.find((item) => item.id === exerciseId);

      if (!exercise || exercise.id === selectedExerciseId) {
        return;
      }

      const replacesDiagram =
        exercise.starterDiagram !== undefined &&
        hasDiagramContent(currentProgram);

      const applyExerciseSelection = () => {
        setSelectedExerciseId(exercise.id);
        setBlockedConnectionMessage(null);
        setIsAutoRunning(false);
        resetCodeGeneration();

        loadedExerciseStarterCodeRef.current = null;

        if (exercise.starterDiagram) {
          loadStarterDiagram(exercise.starterDiagram);
        }
      };

      if (replacesDiagram) {
        requestReplaceConfirmation(applyExerciseSelection);
        return;
      }

      applyExerciseSelection();
    },
    [
      currentProgram,
      exerciseCatalog,
      loadedExerciseStarterCodeRef,
      loadStarterDiagram,
      requestReplaceConfirmation,
      resetCodeGeneration,
      selectedExerciseId,
      setBlockedConnectionMessage,
      setIsAutoRunning,
      setSelectedExerciseId,
    ],
  );

  return {
    clearExerciseSelection,
    exerciseCatalog,
    handleSelectExercise,
    selectedExercise,
  };
}
