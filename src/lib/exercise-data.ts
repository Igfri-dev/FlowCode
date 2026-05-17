import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/lib/db";
import type { Exercise } from "@/features/exercises/types";

type ExerciseRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  description: string;
  objective: string;
  difficulty: Exercise["difficulty"];
  starter_code: string | null;
  tags: string | null;
};

export async function listDatabaseExercises(): Promise<Exercise[]> {
  const rows = await queryRows<ExerciseRow>(
    `SELECT id, slug, title, description, objective, difficulty, starter_code, tags
     FROM exercises
     WHERE is_active = 1
     ORDER BY created_at DESC, id DESC`,
  );

  return rows.map((row) => ({
    id: `db-${row.id}`,
    title: row.title,
    description: row.description,
    objective: row.objective,
    difficulty: row.difficulty,
    starterCode: row.starter_code ?? undefined,
    tags: parseTags(row.tags),
  }));
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
