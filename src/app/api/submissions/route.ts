import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { parseExerciseTestCases, runFlowProgramTests } from "@/lib/flow-test-runner";
import { ensureRuntimeSchema } from "@/lib/schema";
import type { FlowProgram } from "@/types/flow";
import type { RowDataPacket } from "mysql2/promise";

type ExerciseTestRow = RowDataPacket & {
  test_cases: string | null;
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
    program?: unknown;
    title?: unknown;
  };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const code = typeof body.code === "string" ? body.code : "";
  const exerciseId =
    typeof body.exerciseId === "string" && body.exerciseId.startsWith("db-")
      ? Number(body.exerciseId.slice(3))
      : null;

  if (!title || !body.program) {
    return NextResponse.json({ message: "Invalid submission" }, { status: 400 });
  }

  const program = body.program as FlowProgram;
  const testResult = await getSubmissionTestResult(exerciseId, program);

  await getPool().execute(
    `INSERT INTO submissions
       (student_id, exercise_id, title, code, diagram_json, test_result_json)
     VALUES
       (:studentId, :exerciseId, :title, :code, :diagramJson, :testResultJson)`,
    {
      studentId: user.id,
      exerciseId: Number.isFinite(exerciseId) ? exerciseId : null,
      title,
      code,
      diagramJson: JSON.stringify(program),
      testResultJson: testResult ? JSON.stringify(testResult) : null,
    },
  );

  return NextResponse.json({ ok: true });
}

async function getSubmissionTestResult(
  exerciseId: number | null,
  program: FlowProgram,
) {
  if (!exerciseId || !Number.isFinite(exerciseId)) {
    return null;
  }

  const [rows] = await getPool().query<ExerciseTestRow[]>(
    "SELECT test_cases FROM exercises WHERE id = :exerciseId LIMIT 1",
    { exerciseId },
  );
  const testCases = parseExerciseTestCases(rows[0]?.test_cases ?? null);

  if (testCases.length === 0) {
    return null;
  }

  return runFlowProgramTests({
    program,
    testCases,
  });
}
