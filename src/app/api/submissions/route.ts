import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { ensureRuntimeSchema } from "@/lib/schema";
import { getSubmissionTestResult } from "@/lib/submission-tests";
import type { FlowProgram } from "@/types/flow";
import type { RowDataPacket } from "mysql2/promise";

type ExerciseAvailabilityRow = RowDataPacket & {
  can_submit: number;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await ensureRuntimeSchema();

  const body = (await request.json()) as {
    code?: unknown;
    exerciseId?: unknown;
    exerciseKey?: unknown;
    exerciseLanguage?: unknown;
    exerciseTitle?: unknown;
    program?: unknown;
    title?: unknown;
  };
  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
  const code = typeof body.code === "string" ? body.code : "";
  const exerciseId =
    typeof body.exerciseId === "string" && body.exerciseId.startsWith("db-")
      ? Number(body.exerciseId.slice(3))
      : null;
  const exerciseKey =
    typeof body.exerciseKey === "string"
      ? body.exerciseKey.slice(0, 160)
      : typeof body.exerciseId === "string" && !body.exerciseId.startsWith("db-")
        ? body.exerciseId.slice(0, 160)
        : null;
  const exerciseTitle =
    typeof body.exerciseTitle === "string"
      ? body.exerciseTitle.trim().slice(0, 180)
      : null;
  const exerciseLanguage = body.exerciseLanguage === "en" ? "en" : "es";

  if (!title || !body.program) {
    return NextResponse.json({ message: "Invalid submission" }, { status: 400 });
  }

  if (!(await canSubmitExercise(exerciseId, exerciseKey))) {
    return NextResponse.json(
      { message: "The submission deadline has passed." },
      { status: 403 },
    );
  }

  const program = body.program as FlowProgram;
  const testResult = await getSubmissionTestResult({
    exerciseId,
    exerciseKey,
    language: exerciseLanguage,
    program,
  });

  await getPool().execute(
    `INSERT INTO submissions
       (student_id, exercise_id, exercise_key, exercise_title, title, code,
        diagram_json, test_result_json)
     VALUES
       (:studentId, :exerciseId, :exerciseKey, :exerciseTitle, :title, :code,
        :diagramJson, :testResultJson)`,
    {
      studentId: user.id,
      exerciseId: Number.isFinite(exerciseId) ? exerciseId : null,
      exerciseKey,
      exerciseTitle,
      title,
      code,
      diagramJson: JSON.stringify(program),
      testResultJson: testResult ? JSON.stringify(testResult) : null,
    },
  );

  return NextResponse.json({ ok: true });
}

async function canSubmitExercise(
  exerciseId: number | null,
  exerciseKey: string | null,
) {
  if (!exerciseId && !exerciseKey) {
    return true;
  }

  const [rows] = await getPool().query<ExerciseAvailabilityRow[]>(
    `SELECT (submission_deadline IS NULL OR submission_deadline > NOW()) AS can_submit
     FROM exercises
     WHERE (:exerciseId IS NOT NULL AND id = :exerciseId)
        OR (:exerciseId IS NULL AND source_key = :exerciseKey)
     LIMIT 1`,
    { exerciseId, exerciseKey },
  );

  return !rows[0] || rows[0].can_submit === 1;
}
