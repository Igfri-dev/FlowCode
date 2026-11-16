import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "@/lib/db";
import { resolveExerciseTestCases } from "@/lib/exercise-test-policy";
import {
  parseExerciseTestCases,
  runFlowProgramTests,
} from "@/lib/flow-test-runner";
import type { Language } from "@/features/i18n/translations";
import type { FlowProgram } from "@/types/flow";

type ExerciseTestRow = RowDataPacket & {
  source_key: string | null;
  test_cases: string | object | null;
};

export async function getSubmissionTestResult({
  exerciseId,
  exerciseKey,
  organizationId,
  language,
  program,
}: {
  exerciseId: number | null;
  exerciseKey: string | null;
  organizationId: number | null;
  language: Language;
  program: FlowProgram;
}) {
  let sourceId = exerciseKey;
  let row: ExerciseTestRow | undefined;

  if (exerciseId && Number.isFinite(exerciseId)) {
    const [rows] = await getPool().query<ExerciseTestRow[]>(
      `SELECT source_key, test_cases
       FROM exercises
       WHERE id = :exerciseId
         AND (organization_id IS NULL OR organization_id = :organizationId)
       LIMIT 1`,
      { exerciseId, organizationId },
    );
    row = rows[0];
  } else if (sourceId) {
    const [rows] = await getPool().query<ExerciseTestRow[]>(
      `SELECT source_key, test_cases
       FROM exercises
       WHERE source_key = :sourceId
         AND organization_id IS NULL
       LIMIT 1`,
      { organizationId, sourceId },
    );
    row = rows[0];
  }

  // A database exercise's source is authoritative. A custom exercise with a
  // null source_key must not inherit the client-supplied exerciseKey.
  sourceId = row ? row.source_key : sourceId;
  const testCases = resolveExerciseTestCases({
    sourceId,
    storedTestCases: parseStoredTestCases(row?.test_cases ?? null),
    language,
  });

  if (testCases.length === 0) {
    return null;
  }

  return runFlowProgramTests({ program, testCases });
}

function parseStoredTestCases(value: string | object | null) {
  if (!value) {
    return [];
  }

  return parseExerciseTestCases(
    typeof value === "string" ? value : JSON.stringify(value),
  );
}
