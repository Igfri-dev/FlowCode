import type { RowDataPacket } from "mysql2/promise";
import { queryOne, queryRows } from "@/lib/db";
import { ensureRuntimeSchema } from "@/lib/schema";
import type { UserRole } from "@/lib/auth";
import type { ExerciseDifficulty } from "@/features/exercises/types";
import type { FlowProgram } from "@/types/flow";
import type { ExerciseTestRunResult } from "@/lib/flow-test-runner";

export type AdminUser = {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export type AdminExercise = {
  id: number;
  slug: string;
  title: string;
  difficulty: ExerciseDifficulty;
  createdBy: string | null;
  createdAt: string;
  hasTests: boolean;
};

export type SubmissionStatus =
  | "submitted"
  | "approved"
  | "incomplete"
  | "rejected";

export type AdminSubmission = {
  id: number;
  title: string;
  status: SubmissionStatus;
  studentName: string;
  studentUsername: string;
  exerciseTitle: string | null;
  submittedAt: string;
  testPassed: boolean | null;
};

export type SubmissionReview = AdminSubmission & {
  code: string | null;
  diagramJson: FlowProgram;
  feedback: string | null;
  testResult: ExerciseTestRunResult | null;
};

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: number;
  created_at: Date;
};

type ExerciseRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  difficulty: ExerciseDifficulty;
  created_by_name: string | null;
  created_at: Date;
  test_cases: string | null;
};

type SubmissionRow = RowDataPacket & {
  id: number;
  title: string;
  status: SubmissionStatus;
  student_name: string;
  student_username: string;
  exercise_title: string | null;
  submitted_at: Date;
  test_result_json: string | ExerciseTestRunResult | null;
};

type SubmissionReviewRow = SubmissionRow & {
  code: string | null;
  diagram_json: string | FlowProgram;
  feedback: string | null;
};

export async function listAdminUsers() {
  const rows = await queryRows<UserRow>(
    `SELECT id, username, full_name, role, is_active, created_at
     FROM users
     ORDER BY created_at DESC, id DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active === 1,
    createdAt: row.created_at.toISOString().slice(0, 10),
  }));
}

export async function listAdminExercises() {
  await ensureRuntimeSchema();

  const rows = await queryRows<ExerciseRow>(
    `SELECT e.id, e.slug, e.title, e.difficulty, e.created_at, e.test_cases,
            u.full_name AS created_by_name
     FROM exercises e
     LEFT JOIN users u ON u.id = e.created_by
     ORDER BY e.created_at DESC, e.id DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    createdBy: row.created_by_name,
    createdAt: row.created_at.toISOString().slice(0, 10),
    hasTests: Boolean(row.test_cases),
  }));
}

export async function listAdminSubmissions() {
  await ensureRuntimeSchema();

  const rows = await queryRows<SubmissionRow>(
    `SELECT s.id, s.title, s.status, s.submitted_at, s.test_result_json,
            student.full_name AS student_name,
            student.username AS student_username,
            e.title AS exercise_title
     FROM submissions s
     INNER JOIN users student ON student.id = s.student_id
     LEFT JOIN exercises e ON e.id = s.exercise_id
     ORDER BY s.submitted_at DESC, s.id DESC
     LIMIT 100`,
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    studentName: row.student_name,
    studentUsername: row.student_username,
    exerciseTitle: row.exercise_title,
    submittedAt: row.submitted_at.toISOString().replace("T", " ").slice(0, 16),
    testPassed: getTestPassed(row.test_result_json),
  }));
}

export async function getSubmissionReview(id: number) {
  await ensureRuntimeSchema();

  const row = await queryOne<SubmissionReviewRow>(
    `SELECT s.id, s.title, s.status, s.submitted_at, s.code, s.diagram_json,
            s.feedback, s.test_result_json,
            student.full_name AS student_name,
            student.username AS student_username,
            e.title AS exercise_title
     FROM submissions s
     INNER JOIN users student ON student.id = s.student_id
     LEFT JOIN exercises e ON e.id = s.exercise_id
     WHERE s.id = :id
     LIMIT 1`,
    { id },
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    studentName: row.student_name,
    studentUsername: row.student_username,
    exerciseTitle: row.exercise_title,
    submittedAt: row.submitted_at.toISOString().replace("T", " ").slice(0, 16),
    testPassed: getTestPassed(row.test_result_json),
    code: row.code,
    diagramJson: parseDiagramJson(row.diagram_json),
    feedback: row.feedback,
    testResult: parseTestResult(row.test_result_json),
  } satisfies SubmissionReview;
}

export async function listStudentSubmissions(studentId: number) {
  await ensureRuntimeSchema();

  const rows = await queryRows<SubmissionRow>(
    `SELECT s.id, s.title, s.status, s.submitted_at, s.test_result_json,
            student.full_name AS student_name,
            student.username AS student_username,
            e.title AS exercise_title
     FROM submissions s
     INNER JOIN users student ON student.id = s.student_id
     LEFT JOIN exercises e ON e.id = s.exercise_id
     WHERE s.student_id = :studentId
     ORDER BY s.submitted_at DESC, s.id DESC`,
    { studentId },
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    studentName: row.student_name,
    studentUsername: row.student_username,
    exerciseTitle: row.exercise_title,
    submittedAt: row.submitted_at.toISOString().replace("T", " ").slice(0, 16),
    testPassed: getTestPassed(row.test_result_json),
  }));
}

function parseDiagramJson(value: string | FlowProgram) {
  if (typeof value !== "string") {
    return value;
  }

  return JSON.parse(value) as FlowProgram;
}

function parseTestResult(value: string | ExerciseTestRunResult | null) {
  if (!value) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  return JSON.parse(value) as ExerciseTestRunResult;
}

function getTestPassed(value: string | ExerciseTestRunResult | null) {
  return parseTestResult(value)?.passed ?? null;
}
