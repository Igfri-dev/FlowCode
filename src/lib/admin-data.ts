import type { RowDataPacket } from "mysql2/promise";
import { queryOne, queryRows } from "@/lib/db";
import { ensureRuntimeSchema } from "@/lib/schema";
import type { SessionUser, UserRole } from "@/lib/auth";
import type { ExerciseDifficulty } from "@/features/exercises/types";
import { getExercises } from "@/features/exercises/data/exercises";
import type { FlowProgram } from "@/types/flow";
import type { ExerciseTestRunResult } from "@/lib/flow-test-runner";
import {
  canManageExerciseScope,
  getExerciseScope,
} from "@/lib/exercise-scope";

export type AdminUser = {
  id: number;
  username: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  organizationId: number | null;
  organizationName: string | null;
};

export type UserGroupType =
  | "organization"
  | "course"
  | "administrators"
  | "custom";

export type AdminUserGroup = {
  id: number;
  name: string;
  type: UserGroupType;
  organizationId: number | null;
  organizationName: string | null;
  memberIds: number[];
  memberCount: number;
  createdAt: string;
};

export type AdminOrganization = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  teacherCount: number;
  studentCount: number;
  exerciseCount: number;
  submissionCount: number;
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
  organizationId: number | null;
  organizationName: string | null;
  scope: "global" | "organization";
  canManage: boolean;
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
  organizationId: number | null;
  organizationName: string | null;
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
  email: string | null;
  full_name: string;
  role: UserRole;
  is_active: number;
  created_at: Date;
  organization_id: number | null;
  organization_name: string | null;
};

type UserGroupRow = RowDataPacket & {
  id: number;
  name: string;
  group_type: UserGroupType;
  organization_id: number | null;
  organization_name: string | null;
  created_at: Date;
};

type UserGroupMemberRow = RowDataPacket & {
  group_id: number;
  user_id: number;
};

type OrganizationRow = RowDataPacket & {
  id: number;
  name: string;
  slug: string;
  is_active: number;
  teacher_count: number;
  student_count: number;
  custom_exercise_count: number;
  global_custom_exercise_count: number;
  global_hidden_builtin_count: number;
  submission_count: number;
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
  organization_id: number | null;
  organization_name: string | null;
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
  organization_id: number | null;
  organization_name: string | null;
};

type SubmissionReviewRow = SubmissionRow & {
  code: string | null;
  diagram_json: string | FlowProgram;
  feedback: string | null;
};

export async function listOrganizations(): Promise<AdminOrganization[]> {
  await ensureRuntimeSchema();
  const rows = await queryRows<OrganizationRow>(
    `SELECT organization.id, organization.name, organization.slug,
            organization.is_active, organization.created_at,
            (SELECT COUNT(*) FROM users u
             WHERE u.organization_id = organization.id AND u.role = 'teacher') AS teacher_count,
            (SELECT COUNT(*) FROM users u
             WHERE u.organization_id = organization.id AND u.role = 'student') AS student_count,
            (SELECT COUNT(*) FROM exercises e
             WHERE e.organization_id = organization.id
               AND e.source_key IS NULL
               AND e.is_active = 1) AS custom_exercise_count,
            (SELECT COUNT(*) FROM exercises e
             WHERE e.organization_id IS NULL
               AND e.source_key IS NULL
               AND e.is_active = 1) AS global_custom_exercise_count,
            (SELECT COUNT(*) FROM exercises e
             WHERE e.organization_id IS NULL
               AND e.source_key IS NOT NULL
               AND e.is_active = 0) AS global_hidden_builtin_count,
            (SELECT COUNT(*) FROM submissions s
             WHERE s.organization_id = organization.id) AS submission_count
     FROM organizations organization
     ORDER BY organization.name, organization.id`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active === 1,
    teacherCount: Number(row.teacher_count),
    studentCount: Number(row.student_count),
    exerciseCount:
      getExercises("es").length +
      Number(row.global_custom_exercise_count) +
      Number(row.custom_exercise_count) -
      Number(row.global_hidden_builtin_count),
    submissionCount: Number(row.submission_count),
    createdAt: row.created_at.toISOString().slice(0, 10),
  }));
}

export async function listAdminUsers(viewer: SessionUser) {
  await ensureRuntimeSchema();
  const rows = await queryRows<UserRow>(
    `SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.created_at,
            u.organization_id, organization.name AS organization_name
     FROM users u
     LEFT JOIN organizations organization ON organization.id = u.organization_id
     WHERE :isAdmin = 1
        OR (u.organization_id = :organizationId AND u.role = 'student')
     ORDER BY u.created_at DESC, u.id DESC`,
    {
      isAdmin: viewer.role === "admin" ? 1 : 0,
      organizationId: viewer.organizationId,
    },
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active === 1,
    createdAt: row.created_at.toISOString().slice(0, 10),
    organizationId: row.organization_id,
    organizationName: row.organization_name,
  }));
}

export async function listUserGroups(
  viewer: SessionUser,
): Promise<AdminUserGroup[]> {
  await ensureRuntimeSchema();
  const groups = await queryRows<UserGroupRow>(
    `SELECT user_group.id, user_group.name, user_group.group_type,
            user_group.organization_id, organization.name AS organization_name,
            user_group.created_at
     FROM user_groups user_group
     LEFT JOIN organizations organization
       ON organization.id = user_group.organization_id
     WHERE :isAdmin = 1 OR user_group.organization_id = :organizationId
     ORDER BY user_group.name, user_group.id`,
    {
      isAdmin: viewer.role === "admin" ? 1 : 0,
      organizationId: viewer.organizationId,
    },
  );

  if (groups.length === 0) {
    return [];
  }

  const members = await queryRows<UserGroupMemberRow>(
    `SELECT member.group_id, member.user_id
     FROM user_group_members member
     INNER JOIN user_groups user_group ON user_group.id = member.group_id
     WHERE :isAdmin = 1 OR user_group.organization_id = :organizationId
     ORDER BY member.added_at, member.user_id`,
    {
      isAdmin: viewer.role === "admin" ? 1 : 0,
      organizationId: viewer.organizationId,
    },
  );
  const memberIdsByGroup = new Map<number, number[]>();

  for (const member of members) {
    const memberIds = memberIdsByGroup.get(Number(member.group_id)) ?? [];
    memberIds.push(Number(member.user_id));
    memberIdsByGroup.set(Number(member.group_id), memberIds);
  }

  return groups.map((group) => {
    const memberIds = memberIdsByGroup.get(Number(group.id)) ?? [];

    return {
      id: Number(group.id),
      name: group.name,
      type: group.group_type,
      organizationId: group.organization_id,
      organizationName: group.organization_name,
      memberIds,
      memberCount: memberIds.length,
      createdAt: group.created_at.toISOString().slice(0, 10),
    };
  });
}

export async function listAdminExercises(viewer: SessionUser) {
  await ensureRuntimeSchema();

  const rows = await queryRows<ExerciseRow>(
    `SELECT e.id, e.organization_id, organization.name AS organization_name,
            e.slug, e.source_key, e.title, e.description, e.objective, e.difficulty,
            e.starter_code, e.test_cases,
            DATE_FORMAT(e.submission_deadline, '%Y-%m-%dT%H:%i') AS submission_deadline,
            e.tags, e.is_active, e.created_at,
            u.full_name AS created_by_name,
            (SELECT COUNT(*) FROM submissions s
             WHERE (s.exercise_id = e.id
                OR (e.source_key IS NOT NULL AND s.exercise_key = e.source_key))
               AND (:isAdmin = 1 OR s.organization_id = :organizationId)) AS submission_count
     FROM exercises e
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN organizations organization ON organization.id = e.organization_id
     WHERE e.organization_id IS NULL
        OR :isAdmin = 1
        OR e.organization_id = :organizationId
     ORDER BY e.created_at DESC, e.id DESC`,
    {
      isAdmin: viewer.role === "admin" ? 1 : 0,
      organizationId: viewer.organizationId,
    },
  );

  const sourceOverrides = new Map(
    rows
      .filter((row) => row.source_key && row.organization_id === null)
      .map((row) => [row.source_key as string, row]),
  );
  const customExercises = rows
    .filter((row) => !row.source_key && row.is_active === 1)
    .map((row) => mapDatabaseExercise(row, false, viewer));
  const builtInSubmissionCounts = await queryRows<
    RowDataPacket & { source_key: string; submission_count: number }
  >(
    `SELECT exercise_key AS source_key, COUNT(*) AS submission_count
     FROM submissions
     WHERE exercise_key IS NOT NULL
       AND (:isAdmin = 1 OR organization_id = :organizationId)
     GROUP BY exercise_key`,
    {
      isAdmin: viewer.role === "admin" ? 1 : 0,
      organizationId: viewer.organizationId,
    },
  );
  const submissionCountsBySource = new Map(
    builtInSubmissionCounts.map((row) => [
      row.source_key,
      Number(row.submission_count),
    ]),
  );
  const builtInExercises = getExercises("es").flatMap((exercise) => {
    const override = sourceOverrides.get(exercise.id);

    if (override?.is_active === 0) {
      return [];
    }

    if (override) {
      return [mapDatabaseExercise(override, true, viewer)];
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
        submissionCount: submissionCountsBySource.get(exercise.id) ?? 0,
        organizationId: null,
        organizationName: null,
        scope: "global",
        canManage: viewer.role === "admin",
      } satisfies AdminExercise,
    ];
  });

  return [...customExercises, ...builtInExercises];
}

function mapDatabaseExercise(
  row: ExerciseRow,
  isBuiltIn: boolean,
  viewer: SessionUser,
): AdminExercise {
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
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    scope: getExerciseScope(row.organization_id),
    canManage: canManageExerciseScope(viewer, row.organization_id),
  };
}

export async function listAdminSubmissions(viewer: SessionUser) {
  await ensureRuntimeSchema();

  const rows = await queryRows<SubmissionRow>(
    `SELECT s.id, s.title, s.status, s.submitted_at, s.updated_at, s.test_result_json,
            s.feedback, s.diagram_json, s.organization_id,
            organization.name AS organization_name,
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
     LEFT JOIN exercises source_exercise
       ON source_exercise.source_key = s.exercise_key
      AND source_exercise.organization_id IS NULL
     LEFT JOIN organizations organization ON organization.id = s.organization_id
     WHERE :isAdmin = 1 OR s.organization_id = :organizationId
     ORDER BY s.submitted_at DESC, s.id DESC`,
    {
      isAdmin: viewer.role === "admin" ? 1 : 0,
      organizationId: viewer.organizationId,
    },
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
    organizationId: row.organization_id,
    organizationName: row.organization_name,
  }));
}

export async function getSubmissionReview(id: number, viewer: SessionUser) {
  await ensureRuntimeSchema();

  const row = await queryOne<SubmissionReviewRow>(
    `SELECT s.id, s.title, s.status, s.submitted_at, s.updated_at, s.code, s.diagram_json,
            s.feedback, s.test_result_json, s.organization_id,
            organization.name AS organization_name,
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
     LEFT JOIN exercises source_exercise
       ON source_exercise.source_key = s.exercise_key
      AND source_exercise.organization_id IS NULL
     LEFT JOIN organizations organization ON organization.id = s.organization_id
     WHERE s.id = :id
       AND (:isAdmin = 1 OR s.organization_id = :organizationId)
     LIMIT 1`,
    {
      id,
      isAdmin: viewer.role === "admin" ? 1 : 0,
      organizationId: viewer.organizationId,
    },
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
    organizationId: row.organization_id,
    organizationName: row.organization_name,
  } satisfies SubmissionReview;
}

export async function listStudentSubmissions(
  studentId: number,
  organizationId: number | null,
) {
  await ensureRuntimeSchema();

  const rows = await queryRows<SubmissionRow>(
    `SELECT s.id, s.title, s.status, s.submitted_at, s.updated_at, s.test_result_json,
            s.feedback, s.organization_id,
            organization.name AS organization_name,
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
     LEFT JOIN exercises source_exercise
       ON source_exercise.source_key = s.exercise_key
      AND source_exercise.organization_id IS NULL
     LEFT JOIN organizations organization ON organization.id = s.organization_id
     WHERE s.student_id = :studentId
       AND s.organization_id <=> :organizationId
     ORDER BY s.submitted_at DESC, s.id DESC`,
    { organizationId, studentId },
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
    organizationId: row.organization_id,
    organizationName: row.organization_name,
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
  organizationId: number | null,
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
     LEFT JOIN exercises source_exercise
       ON source_exercise.source_key = s.exercise_key
      AND source_exercise.organization_id IS NULL
     WHERE s.id = :id
       AND s.student_id = :studentId
       AND s.organization_id <=> :organizationId
     LIMIT 1`,
    { id, organizationId, studentId },
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
