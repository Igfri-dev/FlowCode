"use server";

import { revalidatePath } from "next/cache";
import { getPool } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { isUserRole, requireAdmin, requireTeacherOrAdmin } from "@/lib/auth";
import { parseExerciseTestCases } from "@/lib/flow-test-runner";
import { ensureRuntimeSchema } from "@/lib/schema";
import type { ExerciseDifficulty } from "@/features/exercises/types";
import { getExercises } from "@/features/exercises/data/exercises";
import { normalizeSubmissionDeadlineInput } from "@/lib/submission-deadline";

const difficulties = ["facil", "media", "dificil"] as const;
const submissionStatuses = [
  "submitted",
  "approved",
  "incomplete",
  "rejected",
] as const;

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!username || !fullName || password.length < 6 || !isUserRole(role)) {
    return;
  }

  await getPool().execute(
    `INSERT INTO users (username, password_hash, full_name, role)
     VALUES (:username, :passwordHash, :fullName, :role)`,
    {
      username,
      passwordHash: await hashPassword(password),
      fullName,
      role,
    },
  );

  revalidatePath("/admin");
}

export async function createExerciseAction(formData: FormData) {
  const author = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const difficulty = String(formData.get("difficulty") ?? "");
  const starterCode = String(formData.get("starterCode") ?? "").trim();
  const testCases = String(formData.get("testCases") ?? "").trim();
  const tags = String(formData.get("tags") ?? "").trim();
  const submissionDeadline = normalizeSubmissionDeadlineInput(
    String(formData.get("submissionDeadline") ?? ""),
  );

  if (
    !title ||
    !description ||
    !objective ||
    !testCases ||
    !isDifficulty(difficulty)
  ) {
    return;
  }

  if (testCases) {
    parseExerciseTestCases(testCases);
  }

  await getPool().execute(
    `INSERT INTO exercises
       (slug, title, description, objective, difficulty, starter_code, test_cases,
        submission_deadline, tags, created_by)
     VALUES
       (:slug, :title, :description, :objective, :difficulty, :starterCode, :testCases,
        :submissionDeadline, :tags, :createdBy)`,
    {
      slug: createSlug(title),
      title,
      description,
      objective,
      difficulty,
      starterCode: starterCode || null,
      testCases: testCases || null,
      submissionDeadline,
      tags: tags || null,
      createdBy: author.id,
    },
  );

  revalidatePath("/admin/exercises");
  revalidatePath("/");
}

export async function updateExerciseAction(formData: FormData) {
  const editor = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const exerciseId = Number(formData.get("exerciseId"));
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const difficulty = String(formData.get("difficulty") ?? "");
  const starterCode = String(formData.get("starterCode") ?? "").trim();
  const testCases = String(formData.get("testCases") ?? "").trim();
  const tags = String(formData.get("tags") ?? "").trim();
  const submissionDeadline = normalizeSubmissionDeadlineInput(
    String(formData.get("submissionDeadline") ?? ""),
  );

  if (
    (!isPositiveInteger(exerciseId) && !isBuiltInExerciseId(sourceId)) ||
    !title ||
    !description ||
    !objective ||
    !testCases ||
    !isDifficulty(difficulty)
  ) {
    return;
  }

  if (testCases) {
    parseExerciseTestCases(testCases);
  }

  const values = {
    exerciseId,
    title,
    description,
    objective,
    difficulty,
    starterCode: starterCode || null,
    testCases: testCases || null,
    submissionDeadline,
    tags: tags || null,
  };

  if (isPositiveInteger(exerciseId)) {
    await getPool().execute(
      `UPDATE exercises
       SET title = :title,
           description = :description,
           objective = :objective,
           difficulty = :difficulty,
           starter_code = :starterCode,
           test_cases = :testCases,
           submission_deadline = :submissionDeadline,
           tags = :tags,
           is_active = 1,
           updated_at = NOW()
       WHERE id = :exerciseId`,
      values,
    );
  } else {
    await getPool().execute(
      `INSERT INTO exercises
         (slug, source_key, title, description, objective, difficulty,
          starter_code, test_cases, submission_deadline, tags, is_active, created_by)
       VALUES
         (:slug, :sourceId, :title, :description, :objective, :difficulty,
          :starterCode, :testCases, :submissionDeadline, :tags, 1, :createdBy)`,
      {
        ...values,
        slug: `builtin-${sourceId}`,
        sourceId,
        createdBy: editor.id,
      },
    );
  }

  revalidateExerciseData();
}

export async function deleteExerciseAction(formData: FormData) {
  const editor = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const exerciseId = Number(formData.get("exerciseId"));
  const sourceId = String(formData.get("sourceId") ?? "").trim();

  if (isBuiltInExerciseId(sourceId)) {
    const exercise = getExercises("es").find((item) => item.id === sourceId)!;

    await getPool().execute(
      `INSERT INTO exercises
         (slug, source_key, title, description, objective, difficulty,
          starter_code, tags, is_active, created_by)
       VALUES
         (:slug, :sourceId, :title, :description, :objective, :difficulty,
          :starterCode, :tags, 0, :createdBy)
       ON DUPLICATE KEY UPDATE is_active = 0, updated_at = NOW()`,
      {
        slug: `builtin-${sourceId}`,
        sourceId,
        title: exercise.title,
        description: exercise.description,
        objective: exercise.objective,
        difficulty: exercise.difficulty,
        starterCode: exercise.starterCode ?? null,
        tags: exercise.tags?.join(", ") ?? null,
        createdBy: editor.id,
      },
    );

    revalidateExerciseData();
    return;
  }

  if (!isPositiveInteger(exerciseId)) {
    return;
  }

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE submissions SET exercise_id = NULL WHERE exercise_id = :exerciseId",
      { exerciseId },
    );
    await connection.execute("DELETE FROM exercises WHERE id = :exerciseId", {
      exerciseId,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  revalidateExerciseData();
  revalidatePath("/admin/submissions");
}

export async function updateSubmissionReviewAction(formData: FormData) {
  const reviewer = await requireTeacherOrAdmin();
  await ensureRuntimeSchema();
  const submissionId = Number(formData.get("submissionId"));
  const status = String(formData.get("status") ?? "");
  const feedback = String(formData.get("feedback") ?? "").trim();

  if (!Number.isInteger(submissionId) || !isSubmissionStatus(status)) {
    return;
  }

  await getPool().execute(
    `UPDATE submissions
     SET status = :status,
         feedback = :feedback,
         reviewed_by = :reviewedBy,
         reviewed_at = NOW()
     WHERE id = :submissionId`,
    {
      status,
      feedback: feedback || null,
      reviewedBy: reviewer.id,
      submissionId,
    },
  );

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
}

function isDifficulty(value: string): value is ExerciseDifficulty {
  return difficulties.includes(value as ExerciseDifficulty);
}

function isSubmissionStatus(
  value: string,
): value is (typeof submissionStatuses)[number] {
  return submissionStatuses.includes(
    value as (typeof submissionStatuses)[number],
  );
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function isBuiltInExerciseId(value: string) {
  return Boolean(value) && getExercises("es").some((exercise) => exercise.id === value);
}

function createSlug(value: string) {
  const baseSlug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${baseSlug || "exercise"}-${Date.now().toString(36)}`;
}

function revalidateExerciseData() {
  revalidatePath("/admin/exercises");
  revalidatePath("/");
  revalidatePath("/student/submissions");
}
