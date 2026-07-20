import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { ensureRuntimeSchema } from "@/lib/schema";
import { getSubmissionTestResult } from "@/lib/submission-tests";
import type { FlowProgram } from "@/types/flow";

type SubmissionContextRow = RowDataPacket & {
  exercise_id: number | null;
  exercise_key: string | null;
  can_edit: number;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const submissionId = Number(id);

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return NextResponse.json({ message: "Invalid submission" }, { status: 400 });
  }

  await ensureRuntimeSchema();

  const context = await getSubmissionContext(submissionId, user.id);

  if (!context) {
    return NextResponse.json({ message: "Submission not found" }, { status: 404 });
  }

  if (context.can_edit !== 1) {
    return deadlinePassedResponse();
  }

  const body = (await request.json()) as {
    code?: unknown;
    exerciseLanguage?: unknown;
    program?: unknown;
    title?: unknown;
  };
  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
  const code = typeof body.code === "string" ? body.code : "";

  if (!title || !body.program) {
    return NextResponse.json({ message: "Invalid submission" }, { status: 400 });
  }

  const program = body.program as FlowProgram;
  const testResult = await getSubmissionTestResult({
    exerciseId: context.exercise_id,
    exerciseKey: context.exercise_key,
    language: body.exerciseLanguage === "en" ? "en" : "es",
    program,
  });
  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE submissions s
     LEFT JOIN exercises exercise ON exercise.id = s.exercise_id
     LEFT JOIN exercises source_exercise ON source_exercise.source_key = s.exercise_key
     SET s.title = :title,
         s.code = :code,
         s.diagram_json = :diagramJson,
         s.test_result_json = :testResultJson,
         s.status = 'submitted',
         s.feedback = NULL,
         s.reviewed_by = NULL,
         s.reviewed_at = NULL,
         s.updated_at = NOW()
     WHERE s.id = :submissionId
       AND s.student_id = :studentId
       AND (
         COALESCE(exercise.submission_deadline, source_exercise.submission_deadline) IS NULL
         OR COALESCE(exercise.submission_deadline, source_exercise.submission_deadline) > NOW()
       )`,
    {
      code,
      diagramJson: JSON.stringify(program),
      studentId: user.id,
      submissionId,
      testResultJson: testResult ? JSON.stringify(testResult) : null,
      title,
    },
  );

  if (result.affectedRows === 0) {
    const latestContext = await getSubmissionContext(submissionId, user.id);

    if (!latestContext) {
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
    }

    if (latestContext.can_edit !== 1) {
      return deadlinePassedResponse();
    }
  }

  revalidatePath("/student/submissions");
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);

  return NextResponse.json({ ok: true });
}

async function getSubmissionContext(submissionId: number, studentId: number) {
  const [rows] = await getPool().query<SubmissionContextRow[]>(
    `SELECT s.exercise_id, s.exercise_key,
            (COALESCE(exercise.submission_deadline, source_exercise.submission_deadline) IS NULL
              OR COALESCE(exercise.submission_deadline, source_exercise.submission_deadline) > NOW()) AS can_edit
     FROM submissions s
     LEFT JOIN exercises exercise ON exercise.id = s.exercise_id
     LEFT JOIN exercises source_exercise ON source_exercise.source_key = s.exercise_key
     WHERE s.id = :submissionId AND s.student_id = :studentId
     LIMIT 1`,
    { studentId, submissionId },
  );

  return rows[0] ?? null;
}

function deadlinePassedResponse() {
  return NextResponse.json(
    { message: "The submission deadline has passed. This work is locked." },
    { status: 403 },
  );
}
