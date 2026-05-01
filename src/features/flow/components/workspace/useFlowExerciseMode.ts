import { useCallback, useMemo, type RefObject } from "react";
import { getExercises } from "@/features/exercises/data/exercises";
import type { ExerciseStarterDiagram } from "@/features/exercises/types";
import type { useI18n } from "@/features/i18n/I18nProvider";
import type { Language } from "@/features/i18n/translations";
import type { FlowProgram } from "@/types/flow";
import type { ImportStatus } from "./useFlowImportExport";
import { hasDiagramContent } from "./flowWorkspaceSerialization";

export function useFlowExerciseMode({
  currentProgram,
  importCode,
  language,
  loadedExerciseStarterCodeRef,
  loadStarterDiagram,
  selectedExerciseId,
  requestReplaceConfirmation,
  resetCodeGeneration,
  setBlockedConnectionMessage,
  setImportCode,
  setImportMessage,
  setImportStatus,
  setImportWarnings,
  setIsAutoRunning,
  setSelectedExerciseId,
  t,
}: {
  currentProgram: FlowProgram;
  importCode: string;
  language: Language;
  loadedExerciseStarterCodeRef: RefObject<string | null>;
  loadStarterDiagram: (starterDiagram: ExerciseStarterDiagram) => void;
  requestReplaceConfirmation: (onConfirm: () => void) => void;
  selectedExerciseId: string | null;
  resetCodeGeneration: () => void;
  setBlockedConnectionMessage: (message: string | null) => void;
  setImportCode: (code: string) => void;
  setImportMessage: (message: string | null) => void;
  setImportStatus: (status: ImportStatus) => void;
  setImportWarnings: (warnings: string[]) => void;
  setIsAutoRunning: (isAutoRunning: boolean) => void;
  setSelectedExerciseId: (exerciseId: string | null) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const exerciseCatalog = useMemo(() => getExercises(language), [language]);
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

      const replacesEditedStarterCode =
        exercise.starterCode !== undefined &&
        importCode.trim().length > 0 &&
        importCode !== exercise.starterCode &&
        importCode !== loadedExerciseStarterCodeRef.current;
      const replacesDiagram =
        exercise.starterDiagram !== undefined &&
        hasDiagramContent(currentProgram);

      const applyExerciseSelection = () => {
        setSelectedExerciseId(exercise.id);
        setBlockedConnectionMessage(null);
        setIsAutoRunning(false);
        resetCodeGeneration();

        if (exercise.starterCode !== undefined) {
          setImportCode(exercise.starterCode);
          setImportStatus("success");
          setImportMessage(t("flow.importLoaded"));
          setImportWarnings([]);
          loadedExerciseStarterCodeRef.current = exercise.starterCode;
        } else {
          loadedExerciseStarterCodeRef.current = null;
        }

        if (exercise.starterDiagram) {
          loadStarterDiagram(exercise.starterDiagram);
        }
      };

      if (replacesEditedStarterCode || replacesDiagram) {
        requestReplaceConfirmation(applyExerciseSelection);
        return;
      }

      applyExerciseSelection();
    },
    [
      currentProgram,
      exerciseCatalog,
      importCode,
      loadedExerciseStarterCodeRef,
      loadStarterDiagram,
      requestReplaceConfirmation,
      resetCodeGeneration,
      selectedExerciseId,
      setBlockedConnectionMessage,
      setImportCode,
      setImportMessage,
      setImportStatus,
      setImportWarnings,
      setIsAutoRunning,
      setSelectedExerciseId,
      t,
    ],
  );

  return {
    clearExerciseSelection,
    exerciseCatalog,
    handleSelectExercise,
    selectedExercise,
  };
}
