import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/lib/db";
import { ensureRuntimeSchema } from "@/lib/schema";
import type { Exercise } from "@/features/exercises/types";
import { parseExerciseTestCases } from "@/lib/flow-test-runner";

type ExerciseRow = RowDataPacket & {
  id: number;
  slug: string;
  source_key: string | null;
  title: string;
  description: string;
  objective: string;
  difficulty: Exercise["difficulty"];
  starter_code: string | null;
  test_cases: string | object | null;
  submission_deadline: string | null;
  tags: string | null;
  is_active: number;
};

export async function listDatabaseExercises(
  organizationId: number | null,
): Promise<Exercise[]> {
  await ensureRuntimeSchema();
  const rows = await queryRows<ExerciseRow>(
    `SELECT id, slug, source_key, title, description, objective, difficulty,
            starter_code, test_cases,
            DATE_FORMAT(submission_deadline, '%Y-%m-%dT%H:%i') AS submission_deadline,
            tags, is_active
     FROM exercises
     WHERE (organization_id IS NULL OR organization_id = :organizationId)
       AND (source_key IS NULL OR organization_id IS NULL)
       AND (is_active = 1 OR source_key IS NOT NULL)
     ORDER BY organization_id IS NULL, created_at DESC, id DESC`,
    { organizationId },
  );

  return rows.map((row) => ({
    id: `db-${row.id}`,
    sourceId: row.source_key ?? undefined,
    isHidden: row.is_active !== 1,
    title: row.title,
    description: row.description,
    objective: row.objective,
    difficulty: row.difficulty,
    starterCode: row.starter_code ?? undefined,
    testCases: parseStoredTestCases(row.test_cases),
    submissionDeadline: row.submission_deadline,
    tags: parseTags(row.tags),
  }));
}

function parseStoredTestCases(value: string | object | null) {
  if (!value) {
    return undefined;
  }

  const testCases = parseExerciseTestCases(
    typeof value === "string" ? value : JSON.stringify(value),
  );

  return testCases.length > 0 ? testCases : undefined;
}

function parseTags(value: string | null) {
  if (!value) {
    return undefined;
  }

  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : undefined;
}
