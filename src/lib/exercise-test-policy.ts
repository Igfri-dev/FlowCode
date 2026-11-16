import { getExercises } from "@/features/exercises/data/exercises";
import type { Language } from "@/features/i18n/translations";
import type { ExerciseTestCase } from "@/lib/flow-test-runner";

/** Resolve teacher-authored tests against the built-in exercise policy.
 * Older database rows predate technique requirements. Missing requirements
 * inherit the source exercise; an explicit array (including []) is a teacher
 * override and is never taken from a student's submitted program.
 */
export function resolveExerciseTestCases({
  sourceId,
  storedTestCases,
  language = "es",
}: {
  sourceId: string | null | undefined;
  storedTestCases: ExerciseTestCase[] | undefined;
  language?: Language;
}): ExerciseTestCase[] {
  const reference = sourceId
    ? (getExercises(language).find((exercise) => exercise.id === sourceId)
        ?.testCases ?? [])
    : [];

  if (!storedTestCases?.length) return reference;
  return inheritTestRequirements(storedTestCases, reference);
}

export function inheritTestRequirements(
  stored: ExerciseTestCase[],
  reference: ExerciseTestCase[],
): ExerciseTestCase[] {
  // An additional case inherits requirements shared by every source case,
  // rather than accidentally bypassing the policy through its array index.
  const common = reference[0]?.requirements?.filter((technique) =>
    reference.every((testCase) => testCase.requirements?.includes(technique)),
  );

  return stored.map((testCase, index) => {
    if (testCase.requirements !== undefined) return testCase;
    const requirements = reference[index]?.requirements ?? common;
    return requirements?.length
      ? { ...testCase, requirements: [...requirements] }
      : testCase;
  });
}
