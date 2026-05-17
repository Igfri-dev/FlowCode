"use server";

import { revalidatePath } from "next/cache";
import { getPool } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { isUserRole, requireAdmin, requireTeacherOrAdmin } from "@/lib/auth";
import { parseExerciseTestCases } from "@/lib/flow-test-runner";
import { ensureRuntimeSchema } from "@/lib/schema";
import type { ExerciseDifficulty } from "@/features/exercises/types";

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
  const admin = await requireAdmin();
  await ensureRuntimeSchema();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const difficulty = String(formData.get("difficulty") ?? "");
  const starterCode = String(formData.get("starterCode") ?? "").trim();
  const testCases = String(formData.get("testCases") ?? "").trim();
  const tags = String(formData.get("tags") ?? "").trim();

  if (!title || !description || !objective || !isDifficulty(difficulty)) {
    return;
  }

  if (testCases) {
    parseExerciseTestCases(testCases);
  }

  await getPool().execute(
    `INSERT INTO exercises
       (slug, title, description, objective, difficulty, starter_code, test_cases, tags, created_by)
     VALUES
       (:slug, :title, :description, :objective, :difficulty, :starterCode, :testCases, :tags, :createdBy)`,
    {
      slug: createSlug(title),
      title,
      description,
      objective,
      difficulty,
      starterCode: starterCode || null,
      testCases: testCases || null,
      tags: tags || null,
      createdBy: admin.id,
    },
  );

  revalidatePath("/admin/exercises");
  revalidatePath("/");
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

function createSlug(value: string) {
  const baseSlug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${baseSlug || "exercise"}-${Date.now().toString(36)}`;
}
