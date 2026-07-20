import type { RowDataPacket } from "mysql2/promise";
import { queryOne, queryRows } from "@/lib/db";
import { ensureRuntimeSchema } from "@/lib/schema";
import type { UserRole } from "@/lib/auth";
import type { ExerciseDifficulty } from "@/features/exercises/types";
import { getExercises } from "@/features/exercises/data/exercises";
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
  id: number | null;
  sourceId: string | null;
  isBuiltIn: boolean;
  slug: string;
  title: string;
  description: string;
  objective: string;
  difficulty: ExerciseDifficulty;
  starterCode: string;
  testCases: string;
  submissionDeadline: string;
  tags: string;
  createdBy: string | null;
  createdAt: string;
  hasTests: boolean;
  isActive: boolean;
  submissionCount: number;
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
  updatedAt: string;
  submissionDeadline: string | null;
  canEdit: boolean;
  testPassed: boolean | null;
  testResult: ExerciseTestRunResult | null;
  feedback: string | null;
  diagramJson?: FlowProgram;
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
  source_key: string | null;
  title: string;
  description: string;
  objective: string;
  difficulty: ExerciseDifficulty;
  starter_code: string | null;
  tags: string | null;
  created_by_name: string | null;
  created_at: Date;
  test_cases: string | object | null;
  submission_deadline: string | null;
  is_active: number;
  submission_count: number;
};

type SubmissionRow = RowDataPacket & {
  id: number;
  title: string;
  status: SubmissionStatus;
  student_name: string;
  student_username: string;
  exercise_title: string | null;
  submitted_at: Date;
  updated_at: Date;
  submission_deadline: string | null;
  can_edit: number;
  test_result_json: string | ExerciseTestRunResult | null;
  feedback: string | null;
  diagram_json?: string | FlowProgram;
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
    `SELECT e.id, e.slug, e.source_key, e.title, e.description, e.objective, e.difficulty,
            e.starter_code, e.test_cases,
            DATE_FORMAT(e.submission_deadline, '%Y-%m-%dT%H:%i') AS submission_deadline,
            e.tags, e.is_active, e.created_at,
            u.full_name AS created_by_name,
            (SELECT COUNT(*) FROM submissions s
             WHERE s.exercise_id = e.id
                OR (e.source_key IS NOT NULL AND s.exercise_key = e.source_key)) AS submission_count
     FROM exercises e
     LEFT JOIN users u ON u.id = e.created_by
     ORDER BY e.created_at DESC, e.id DESC`,
  );

  const sourceOverrides = new Map(
    rows
      .filter((row) => row.source_key)
      .map((row) => [row.source_key!, row]),
  );
  const customExercises = rows
    .filter((row) => !row.source_key && row.is_active === 1)
    .map((row) => mapDatabaseExercise(row, false));
  const builtInExercises = getExercises("es").flatMap((exercise) => {
    const override = sourceOverrides.get(exercise.id);

    if (override?.is_active === 0) {
      return [];
    }

    if (override) {
      return [mapDatabaseExercise(override, true)];
    }

    return [
      {
        id: null,
        sourceId: exercise.id,
        isBuiltIn: true,
        slug: exercise.id,
        title: exercise.title,
        description: exercise.description,
        objective: exercise.objective,
        difficulty: exercise.difficulty,
        starterCode: exercise.starterCode ?? "",
        testCases: exercise.testCases
          ? JSON.stringify(exercise.testCases, null, 2)
          : "",
        submissionDeadline: "",
        tags: exercise.tags?.join(", ") ?? "",
        createdBy: null,
        createdAt: "—",
        hasTests: Boolean(exercise.testCases?.length),
        isActive: true,
        submissionCount: 0,
      } satisfies AdminExercise,
    ];
  });

  return [...customExercises, ...builtInExercises];
}

function mapDatabaseExercise(row: ExerciseRow, isBuiltIn: boolean): AdminExercise {
  return {
    id: row.id,
    sourceId: row.source_key,
    isBuiltIn,
    slug: row.slug,
    title: row.title,
    description: row.description,
    objective: row.objective,
    difficulty: row.difficulty,
    starterCode: row.starter_code ?? "",
    testCases: stringifyJsonField(row.test_cases),
    submissionDeadline: row.submission_deadline ?? "",
    tags: row.tags ?? "",
    createdBy: row.created_by_name,
    createdAt: row.created_at.toISOString().slice(0, 10),
    hasTests: Boolean(row.test_cases),
    isActive: row.is_active === 1,
    submissionCount: Number(row.submission_count),
  };
}

export async function listAdminSubmissions() {
  await ensureRuntimeSchema();

  const rows = await queryRows<SubmissionRow>(
    `SELECT s.id, s.title, s.status, s.submitted_at, s.updated_at, s.test_result_json,
            s.feedback, s.diagram_json,
            student.full_name AS student_name,
            student.username AS student_username,
            COALESCE(e.title, source_exercise.title, s.exercise_title) AS exercise_title,
            DATE_FORMAT(
              COALESCE(e.submission_deadline, source_exercise.submission_deadline),
              '%Y-%m-%dT%H:%i'
            ) AS submission_deadline,
            (COALESCE(e.submission_deadline, source_exercise.submission_deadline) IS NULL
              OR COALESCE(e.submission_deadline, source_exercise.submission_deadline) > NOW()) AS can_edit
     FROM submissions s
     INNER JOIN users student ON student.id = s.student_id
     LEFT JOIN exercises e ON e.id = s.exercise_id
     LEFT JOIN exercises source_exercise ON source_exercise.source_key = s.exercise_key
     ORDER BY s.submitted_at DESC, s.id DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    studentName: row.student_name,
    studentUsername: row.student_username,
    exerciseTitle: row.exercise_title,
    submittedAt: row.submitted_at.toISOString().replace("T", " ").slice(0, 16),
    updatedAt: row.updated_at.toISOString().replace("T", " ").slice(0, 16),
    submissionDeadline: row.submission_deadline,
    canEdit: row.can_edit === 1,
    testPassed: getTestPassed(row.test_result_json),
    testResult: parseTestResult(row.test_result_json),
    feedback: row.feedback,
    diagramJson: parseDiagramJson(row.diagram_json ?? '{"main":{"nodes":[],"edges":[]},"functions":[]}'),
  }));
}

export async function getSubmissionReview(id: number) {
  await ensureRuntimeSchema();

  const row = await queryOne<SubmissionReviewRow>(
    `SELECT s.id, s.title, s.status, s.submitted_at, s.updated_at, s.code, s.diagram_json,
            s.feedback, s.test_result_json,
            student.full_name AS student_name,
            student.username AS student_username,
            COALESCE(e.title, source_exercise.title, s.exercise_title) AS exercise_title,
            DATE_FORMAT(
              COALESCE(e.submission_deadline, source_exercise.submission_deadline),
              '%Y-%m-%dT%H:%i'
            ) AS submission_deadline,
            (COALESCE(e.submission_deadline, source_exercise.submission_deadline) IS NULL
              OR COALESCE(e.submission_deadline, source_exercise.submission_deadline) > NOW()) AS can_edit
     FROM submissions s
     INNER JOIN users student ON student.id = s.student_id
     LEFT JOIN exercises e ON e.id = s.exercise_id
     LEFT JOIN exercises source_exercise ON source_exercise.source_key = s.exercise_key
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
    updatedAt: row.updated_at.toISOString().replace("T", " ").slice(0, 16),
    submissionDeadline: row.submission_deadline,
    canEdit: row.can_edit === 1,
    testPassed: getTestPassed(row.test_result_json),
    testResult: parseTestResult(row.test_result_json),
    feedback: row.feedback,
    code: row.code,
    diagramJson: parseDiagramJson(row.diagram_json),
  } satisfies SubmissionReview;
}

export async function listStudentSubmissions(studentId: number) {
  await ensureRuntimeSchema();

  const rows = await queryRows<SubmissionRow>(
    `SELECT s.id, s.title, s.status, s.submitted_at, s.updated_at, s.test_result_json,
            s.feedback,
            student.full_name AS student_name,
            student.username AS student_username,
            COALESCE(e.title, source_exercise.title, s.exercise_title) AS exercise_title,
            DATE_FORMAT(
              COALESCE(e.submission_deadline, source_exercise.submission_deadline),
              '%Y-%m-%dT%H:%i'
            ) AS submission_deadline,
            (COALESCE(e.submission_deadline, source_exercise.submission_deadline) IS NULL
              OR COALESCE(e.submission_deadline, source_exercise.submission_deadline) > NOW()) AS can_edit
     FROM submissions s
     INNER JOIN users student ON student.id = s.student_id
     LEFT JOIN exercises e ON e.id = s.exercise_id
     LEFT JOIN exercises source_exercise ON source_exercise.source_key = s.exercise_key
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
    updatedAt: row.updated_at.toISOString().replace("T", " ").slice(0, 16),
    submissionDeadline: row.submission_deadline,
    canEdit: row.can_edit === 1,
    testPassed: getTestPassed(row.test_result_json),
    testResult: parseTestResult(row.test_result_json),
    feedback: row.feedback,
  }));
}

export type StudentEditableSubmission = {
  id: number;
  title: string;
  diagramJson: FlowProgram;
  exerciseId: string | null;
  exerciseTitle: string | null;
  submissionDeadline: string | null;
  canEdit: boolean;
};

type StudentEditableSubmissionRow = RowDataPacket & {
  id: number;
  title: string;
  diagram_json: string | FlowProgram;
  exercise_catalog_id: string | null;
  exercise_title: string | null;
  submission_deadline: string | null;
  can_edit: number;
};

export async function getStudentEditableSubmission(
  id: number,
  studentId: number,
): Promise<StudentEditableSubmission | null> {
  await ensureRuntimeSchema();

  const row = await queryOne<StudentEditableSubmissionRow>(
    `SELECT s.id, s.title, s.diagram_json,
            CASE
              WHEN s.exercise_id IS NOT NULL THEN CONCAT('db-', s.exercise_id)
              WHEN source_exercise.id IS NOT NULL THEN CONCAT('db-', source_exercise.id)
              ELSE s.exercise_key
            END AS exercise_catalog_id,
            COALESCE(e.title, source_exercise.title, s.exercise_title) AS exercise_title,
            DATE_FORMAT(
              COALESCE(e.submission_deadline, source_exercise.submission_deadline),
              '%Y-%m-%dT%H:%i'
            ) AS submission_deadline,
            (COALESCE(e.submission_deadline, source_exercise.submission_deadline) IS NULL
              OR COALESCE(e.submission_deadline, source_exercise.submission_deadline) > NOW()) AS can_edit
     FROM submissions s
     LEFT JOIN exercises e ON e.id = s.exercise_id
     LEFT JOIN exercises source_exercise ON source_exercise.source_key = s.exercise_key
     WHERE s.id = :id AND s.student_id = :studentId
     LIMIT 1`,
    { id, studentId },
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    diagramJson: parseDiagramJson(row.diagram_json),
    exerciseId: row.exercise_catalog_id,
    exerciseTitle: row.exercise_title,
    submissionDeadline: row.submission_deadline,
    canEdit: row.can_edit === 1,
  };
}

function stringifyJsonField(value: string | object | null) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
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
