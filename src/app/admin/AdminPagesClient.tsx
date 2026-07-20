"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
} from "@xyflow/react";
import { logoutAction } from "@/app/actions/auth";
import {
  createExerciseAction,
  createUserAction,
  deleteExerciseAction,
  updateExerciseAction,
  updateSubmissionReviewAction,
} from "@/app/admin/actions";
import { useI18n } from "@/features/i18n/I18nProvider";
import { flowEdgeComponents } from "@/components/editor/edges";
import { flowNodeComponents } from "@/features/flow/components/nodes";
import { FlowNodeRenderProvider } from "@/features/flow/components/nodes/FlowNodeRenderContext";
import type { SessionUser } from "@/lib/auth";
import type {
  AdminExercise,
  AdminSubmission,
  AdminUser,
} from "@/lib/admin-data";
import type { FlowEditorEdge, FlowEditorNode } from "@/types/flow";
import logoImage from "../logo.png";

type AdminChromeProps = {
  children: ReactNode;
  user: SessionUser;
};

type AdminUsersPageProps = {
  user: SessionUser;
  users: AdminUser[];
};

type AdminExercisesPageProps = {
  exercises: AdminExercise[];
  user: SessionUser;
};

type AdminSubmissionsPageProps = {
  submissions: AdminSubmission[];
  user: SessionUser;
};

const copy = {
  es: {
    eyebrow: "Panel",
    title: "Administracion de FlowCode",
    signedIn: "Sesion iniciada como",
    openEditor: "Abrir editor",
    signOut: "Cerrar sesion",
    createUser: "Crear usuario",
    fullName: "Nombre completo",
    username: "Usuario",
    password: "Contrasena",
    createExercise: "Crear ejercicio",
    newExercise: "Nuevo ejercicio",
    editExercise: "Editar ejercicio",
    saveChanges: "Guardar cambios",
    deleteExercise: "Eliminar",
    deleteExerciseConfirm:
      "¿Eliminar este ejercicio? Las entregas existentes se conservaran como entregas libres.",
    exerciseTitle: "Titulo",
    description: "Descripcion",
    objective: "Objetivo",
    starterCode:
      "JavaScript inicial opcional. Se guardara, pero no se mostrara como solucion en el importador.",
    testCases:
      'Tests en JSON. Ejemplo: [{"name":"caso 1","inputs":[5],"expectedOutputs":["10"]}]',
    submissionDeadline: "Fecha limite de entrega",
    submissionDeadlineHelp:
      "Opcional. Despues de esta fecha los alumnos no pueden entregar ni editar.",
    noDeadline: "Sin fecha limite",
    tags: "Etiquetas separadas por coma",
    users: "Usuarios",
    usersHelp: "Gestiona las cuentas de alumnos, profesores y administradores.",
    exercises: "Ejercicios",
    exercisesHelp: "Crea desafios que apareceran en el modo ejercicios.",
    submissions: "Entregas",
    submissionsHelp: "Revisa diagramas enviados y ejecutalos para evaluarlos.",
    search: "Buscar por alumno, ejercicio o entrega",
    searchExercises: "Buscar ejercicios",
    allStudents: "Todos los alumnos",
    allExercises: "Todos los ejercicios",
    allStatuses: "Todos los estados",
    allTestResults: "Todos los tests",
    testPassedFilter: "Tests aprobados",
    testFailedFilter: "Tests fallidos",
    noTestFilter: "Sin tests",
    groupBy: "Agrupar por",
    noGrouping: "Sin agrupar",
    groupStudent: "Alumno",
    groupExercise: "Ejercicio",
    showing: "Mostrando",
    of: "de",
    blocks: "bloques",
    failedCases: "casos fallidos",
    awaitingReview: "Por revisar",
    needsWork: "Necesitan correccion",
    passed: "Aprobadas",
    submissionsCount: "entregas",
    edit: "Editar",
    createdBy: "Creado por",
    noMatchingRows: "No hay resultados para estos filtros.",
    correctionsSaved: "Correcciones guardadas",
    noRows: "Sin registros todavia.",
    freeSubmission: "Entrega libre",
    review: "Revisar",
    tests: "Tests",
    testsPassed: "Tests aprobados",
    testsFailed: "Tests fallidos",
    noTests: "Sin tests",
    languageToggle: "Cambiar idioma",
    activeRole: "Rol activo",
    total: "Total",
  },
  en: {
    eyebrow: "Panel",
    title: "FlowCode administration",
    signedIn: "Signed in as",
    openEditor: "Open editor",
    signOut: "Sign out",
    createUser: "Create user",
    fullName: "Full name",
    username: "Username",
    password: "Password",
    createExercise: "Create exercise",
    newExercise: "New exercise",
    editExercise: "Edit exercise",
    saveChanges: "Save changes",
    deleteExercise: "Delete",
    deleteExerciseConfirm:
      "Delete this exercise? Existing submissions will be preserved as free submissions.",
    exerciseTitle: "Title",
    description: "Description",
    objective: "Objective",
    starterCode:
      "Optional starter JavaScript. It will be saved but not shown as the solution in the import panel.",
    testCases:
      'JSON tests. Example: [{"name":"case 1","inputs":[5],"expectedOutputs":["10"]}]',
    submissionDeadline: "Submission deadline",
    submissionDeadlineHelp:
      "Optional. After this time, students cannot submit or edit their work.",
    noDeadline: "No deadline",
    tags: "Tags separated by comma",
    users: "Users",
    usersHelp: "Manage student, teacher, and administrator accounts.",
    exercises: "Exercises",
    exercisesHelp: "Create challenges that appear in exercise mode.",
    submissions: "Submissions",
    submissionsHelp: "Review submitted diagrams and run them for evaluation.",
    search: "Search by student, exercise, or submission",
    searchExercises: "Search exercises",
    allStudents: "All students",
    allExercises: "All exercises",
    allStatuses: "All statuses",
    allTestResults: "All test results",
    testPassedFilter: "Tests passed",
    testFailedFilter: "Tests failed",
    noTestFilter: "No tests",
    groupBy: "Group by",
    noGrouping: "No grouping",
    groupStudent: "Student",
    groupExercise: "Exercise",
    showing: "Showing",
    of: "of",
    blocks: "blocks",
    failedCases: "failed cases",
    awaitingReview: "Awaiting review",
    needsWork: "Needs correction",
    passed: "Approved",
    submissionsCount: "submissions",
    edit: "Edit",
    createdBy: "Created by",
    noMatchingRows: "No results match these filters.",
    correctionsSaved: "Corrections saved",
    noRows: "No records yet.",
    freeSubmission: "Free submission",
    review: "Review",
    tests: "Tests",
    testsPassed: "Tests passed",
    testsFailed: "Tests failed",
    noTests: "No tests",
    languageToggle: "Change language",
    activeRole: "Active role",
    total: "Total",
  },
} as const;

export function AdminUsersPage({ user, users }: AdminUsersPageProps) {
  const { language } = useI18n();
  const text = copy[language];

  return (
    <AdminChrome user={user}>
      <PageHeader count={users.length} help={text.usersHelp} title={text.users} />
      <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className={panelClassName}>
          <PanelTitle>{text.createUser}</PanelTitle>
          <form action={createUserAction} className="mt-4 grid gap-3">
            <input
              name="fullName"
              placeholder={text.fullName}
              className={inputClassName}
              required
            />
            <input
              name="username"
              placeholder={text.username}
              className={inputClassName}
              required
            />
            <input
              name="password"
              type="password"
              placeholder={text.password}
              className={inputClassName}
              minLength={6}
              required
            />
            <select name="role" className={inputClassName} defaultValue="student">
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="admin">admin</option>
            </select>
            <button className={primaryButtonClassName}>{text.createUser}</button>
          </form>
        </section>

        <AdminTable emptyLabel={text.noRows} title={text.users}>
          {users.map((item) => (
            <tr key={item.id} className={tableRowClassName}>
              <td className={tableCellClassName}>{item.fullName}</td>
              <td className={tableCellClassName}>{item.username}</td>
              <td className={tableCellClassName}>{item.role}</td>
            </tr>
          ))}
        </AdminTable>
      </div>
    </AdminChrome>
  );
}

export function AdminExercisesPage({
  exercises,
  user,
}: AdminExercisesPageProps) {
  const { language } = useI18n();
  const text = copy[language];
  const [query, setQuery] = useState("");
  const [editingExercise, setEditingExercise] = useState<AdminExercise | null>(
    null,
  );
  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return exercises;
    }

    return exercises.filter((exercise) =>
      [
        exercise.title,
        exercise.description,
        exercise.objective,
        exercise.tags,
        exercise.createdBy ?? "",
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [exercises, query]);

  return (
    <AdminChrome user={user}>
      <PageHeader
        count={exercises.length}
        help={text.exercisesHelp}
        title={text.exercises}
      />
      <div className="grid w-full grid-cols-1 items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className={`${panelClassName} xl:sticky xl:top-28`}>
          <PanelTitle>{text.newExercise}</PanelTitle>
          <ExerciseForm action={createExerciseAction} submitLabel={text.createExercise} text={text} />
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{text.exercises}</h2>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {text.showing} {filteredExercises.length} {text.of} {exercises.length}
                </p>
              </div>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.searchExercises}
                className={`${inputClassName} w-full sm:max-w-xs`}
              />
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
            {filteredExercises.length > 0 ? (
              filteredExercises.map((exercise) => (
                <ExerciseCard
                  exercise={exercise}
                  key={exercise.sourceId ?? exercise.id}
                  onEdit={() => setEditingExercise(exercise)}
                  text={text}
                />
              ))
            ) : (
              <EmptyState label={exercises.length > 0 ? text.noMatchingRows : text.noRows} />
            )}
          </div>
        </section>
      </div>

      {editingExercise ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-950/55 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={text.editExercise}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditingExercise(null);
            }
          }}
        >
          <section className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {text.editExercise}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{editingExercise.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingExercise(null)}
                className={iconButtonClassName}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <ExerciseForm
              action={updateExerciseAction}
              exercise={editingExercise}
              onSubmit={() => setEditingExercise(null)}
              submitLabel={text.saveChanges}
              text={text}
            />
          </section>
        </div>
      ) : null}
    </AdminChrome>
  );
}

export function AdminSubmissionsPage({
  submissions,
  user,
}: AdminSubmissionsPageProps) {
  const { language } = useI18n();
  const text = copy[language];
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState("all");
  const [exercise, setExercise] = useState("all");
  const [status, setStatus] = useState("all");
  const [testResult, setTestResult] = useState("all");
  const [groupBy, setGroupBy] = useState<"none" | "student" | "exercise">(
    "none",
  );
  const [previewSubmission, setPreviewSubmission] =
    useState<AdminSubmission | null>(null);
  const students = useMemo(
    () =>
      Array.from(
        new Map(
          submissions.map((submission) => [
            submission.studentUsername,
            {
              label: submission.studentName,
              value: submission.studentUsername,
            },
          ]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [submissions],
  );
  const exercises = useMemo(
    () =>
      Array.from(
        new Set(
          submissions.map(
            (submission) => submission.exerciseTitle ?? text.freeSubmission,
          ),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [submissions, text.freeSubmission],
  );
  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return submissions.filter((submission) => {
      const exerciseTitle = submission.exerciseTitle ?? text.freeSubmission;
      const matchesQuery =
        !normalizedQuery ||
        [
          submission.title,
          submission.studentName,
          submission.studentUsername,
          exerciseTitle,
        ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      const matchesStudent =
        student === "all" || submission.studentUsername === student;
      const matchesExercise = exercise === "all" || exerciseTitle === exercise;
      const matchesStatus = status === "all" || submission.status === status;
      const matchesTest =
        testResult === "all" ||
        (testResult === "passed" && submission.testPassed === true) ||
        (testResult === "failed" && submission.testPassed === false) ||
        (testResult === "none" && submission.testPassed === null);

      return (
        matchesQuery &&
        matchesStudent &&
        matchesExercise &&
        matchesStatus &&
        matchesTest
      );
    });
  }, [exercise, query, status, student, submissions, testResult, text.freeSubmission]);
  const submissionGroups = useMemo(() => {
    if (groupBy === "none") {
      return [["", filteredSubmissions]] as const;
    }

    const groups = new Map<string, AdminSubmission[]>();

    for (const submission of filteredSubmissions) {
      const key =
        groupBy === "student"
          ? submission.studentName
          : (submission.exerciseTitle ?? text.freeSubmission);
      groups.set(key, [...(groups.get(key) ?? []), submission]);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredSubmissions, groupBy, text.freeSubmission]);
  const stats = {
    submitted: submissions.filter((item) => item.status === "submitted").length,
    needsWork: submissions.filter(
      (item) => item.status === "incomplete" || item.status === "rejected",
    ).length,
    approved: submissions.filter((item) => item.status === "approved").length,
  };

  return (
    <AdminChrome user={user}>
      <PageHeader
        count={submissions.length}
        help={text.submissionsHelp}
        title={text.submissions}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label={text.awaitingReview} value={stats.submitted} tone="neutral" />
        <MetricCard label={text.needsWork} value={stats.needsWork} tone="danger" />
        <MetricCard label={text.passed} value={stats.approved} tone="success" />
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.4fr)_repeat(4,minmax(140px,0.7fr))]">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.search}
            className={inputClassName}
          />
          <select value={student} onChange={(event) => setStudent(event.target.value)} className={inputClassName}>
            <option value="all">{text.allStudents}</option>
            {students.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
          <select value={exercise} onChange={(event) => setExercise(event.target.value)} className={inputClassName}>
            <option value="all">{text.allExercises}</option>
            {exercises.map((option) => (
              <option value={option} key={option}>{option}</option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClassName}>
            <option value="all">{text.allStatuses}</option>
            <option value="submitted">submitted</option>
            <option value="approved">approved</option>
            <option value="incomplete">incomplete</option>
            <option value="rejected">rejected</option>
          </select>
          <select value={testResult} onChange={(event) => setTestResult(event.target.value)} className={inputClassName}>
            <option value="all">{text.allTestResults}</option>
            <option value="passed">{text.testPassedFilter}</option>
            <option value="failed">{text.testFailedFilter}</option>
            <option value="none">{text.noTestFilter}</option>
          </select>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            {text.showing} <strong className="text-neutral-900">{filteredSubmissions.length}</strong> {text.of} {submissions.length}
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            {text.groupBy}
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)} className={`${inputClassName} py-1.5`}>
              <option value="none">{text.noGrouping}</option>
              <option value="student">{text.groupStudent}</option>
              <option value="exercise">{text.groupExercise}</option>
            </select>
          </label>
        </div>
      </section>

      {filteredSubmissions.length > 0 ? (
        <div className="grid gap-6">
          {submissionGroups.map(([groupName, groupSubmissions]) => (
            <section key={groupName || "all"}>
              {groupName ? (
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{groupName}</h2>
                  <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
                    {groupSubmissions.length}
                  </span>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {groupSubmissions.map((submission) => (
                  <SubmissionPreviewCard
                    key={submission.id}
                    onPreview={() => setPreviewSubmission(submission)}
                    submission={submission}
                    text={text}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState label={submissions.length > 0 ? text.noMatchingRows : text.noRows} />
      )}
      {previewSubmission?.diagramJson ? (
        <DiagramPreviewModal
          onClose={() => setPreviewSubmission(null)}
          submission={previewSubmission}
        />
      ) : null}
    </AdminChrome>
  );
}

type AdminCopy = (typeof copy)[keyof typeof copy];

function ExerciseForm({
  action,
  exercise,
  onSubmit,
  submitLabel,
  text,
}: {
  action: (formData: FormData) => void | Promise<void>;
  exercise?: AdminExercise;
  onSubmit?: () => void;
  submitLabel: string;
  text: AdminCopy;
}) {
  return (
    <form
      action={action}
      className="mt-4 grid gap-3"
      key={exercise ? (exercise.sourceId ?? exercise.id) : "new"}
      onSubmit={onSubmit}
    >
      {exercise?.id ? (
        <input name="exerciseId" type="hidden" value={exercise.id} />
      ) : null}
      {exercise?.sourceId ? (
        <input name="sourceId" type="hidden" value={exercise.sourceId} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {text.exerciseTitle}
          <input
            name="title"
            defaultValue={exercise?.title}
            placeholder={text.exerciseTitle}
            className={inputClassName}
            required
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Difficulty
          <select
            name="difficulty"
            className={inputClassName}
            defaultValue={exercise?.difficulty ?? "facil"}
          >
            <option value="facil">facil</option>
            <option value="media">media</option>
            <option value="dificil">dificil</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {text.description}
        <textarea
          name="description"
          defaultValue={exercise?.description}
          placeholder={text.description}
          className={`${inputClassName} min-h-20 resize-y normal-case tracking-normal`}
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {text.objective}
        <textarea
          name="objective"
          defaultValue={exercise?.objective}
          placeholder={text.objective}
          className={`${inputClassName} min-h-20 resize-y normal-case tracking-normal`}
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        Starter code
        <textarea
          name="starterCode"
          defaultValue={exercise?.starterCode}
          placeholder={text.starterCode}
          className={`${inputClassName} min-h-28 resize-y font-mono text-xs normal-case tracking-normal`}
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {text.tests}
        <textarea
          name="testCases"
          defaultValue={exercise?.testCases}
          placeholder={text.testCases}
          className={`${inputClassName} min-h-28 resize-y font-mono text-xs normal-case tracking-normal`}
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {text.submissionDeadline}
        <input
          name="submissionDeadline"
          type="datetime-local"
          defaultValue={exercise?.submissionDeadline}
          className={`${inputClassName} normal-case tracking-normal`}
        />
        <span className="text-[11px] font-normal normal-case tracking-normal text-neutral-500">
          {text.submissionDeadlineHelp}
        </span>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {text.tags}
        <input
          name="tags"
          defaultValue={exercise?.tags}
          placeholder={text.tags}
          className={`${inputClassName} normal-case tracking-normal`}
        />
      </label>
      <button className={`${primaryButtonClassName} mt-1`}>{submitLabel}</button>
    </form>
  );
}

function ExerciseCard({
  exercise,
  onEdit,
  text,
}: {
  exercise: AdminExercise;
  onEdit: () => void;
  text: AdminCopy;
}) {
  return (
    <article className="group flex min-h-64 flex-col rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-lg hover:shadow-emerald-950/5">
      <div className="flex items-start justify-between gap-3">
        <DifficultyBadge difficulty={exercise.difficulty} />
        <span className="text-xs font-medium text-neutral-400">
          {exercise.isBuiltIn ? "Built-in" : `#${exercise.id}`}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug text-neutral-950">
        {exercise.title}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-600">
        {exercise.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {exercise.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 4)
          .map((tag) => (
            <span key={tag} className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-neutral-600 ring-1 ring-neutral-200">
              {tag}
            </span>
          ))}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
        <span>{exercise.hasTests ? text.tests : text.noTests}</span>
        <span className="text-right">
          {exercise.submissionCount} {text.submissionsCount}
        </span>
        <span className="col-span-2 truncate">
          {text.createdBy}: {exercise.createdBy ?? "—"}
        </span>
        <span className="col-span-2 truncate">
          {exercise.submissionDeadline
            ? `${text.submissionDeadline}: ${formatDeadline(exercise.submissionDeadline)}`
            : text.noDeadline}
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onEdit} className={`${secondaryButtonClassName} flex-1`}>
          {text.edit}
        </button>
        <form
          action={deleteExerciseAction}
          onSubmit={(event) => {
            if (!window.confirm(text.deleteExerciseConfirm)) {
              event.preventDefault();
            }
          }}
        >
          {exercise.id ? (
            <input name="exerciseId" type="hidden" value={exercise.id} />
          ) : null}
          {exercise.sourceId ? (
            <input name="sourceId" type="hidden" value={exercise.sourceId} />
          ) : null}
          <button className={dangerButtonClassName}>{text.deleteExercise}</button>
        </form>
      </div>
    </article>
  );
}

function SubmissionPreviewCard({
  onPreview,
  submission,
  text,
}: {
  onPreview: () => void;
  submission: AdminSubmission;
  text: AdminCopy;
}) {
  const failedCases =
    submission.testResult?.cases.filter((testCase) => !testCase.passed) ?? [];
  const nodeCount = submission.diagramJson?.main.nodes.length ?? 0;

  return (
    <article className="group rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-950/5">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-emerald-700">
              {submission.exerciseTitle ?? text.freeSubmission}
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold">{submission.title}</h3>
          </div>
          <StatusBadge status={submission.status} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-800">{submission.studentName}</p>
            <p className="truncate text-xs text-neutral-500">@{submission.studentUsername}</p>
          </div>
          <div className="shrink-0 text-right text-xs text-neutral-500">
            <p>{submission.submittedAt}</p>
            <p className="mt-0.5">{nodeCount} {text.blocks}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onPreview}
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-3 text-left text-emerald-950 outline-none transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          aria-label={`Open diagram preview for ${submission.title}`}
        >
          <span>
            <span className="block text-sm font-semibold">Open diagram preview</span>
            <span className="mt-0.5 block text-xs text-emerald-800/70">
              Original layout · {nodeCount} {text.blocks}
            </span>
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-lg text-white shadow-sm" aria-hidden="true">
            ↗
          </span>
        </button>
        <div className="mt-4 flex min-h-12 items-start justify-between gap-3 border-t border-neutral-100 pt-3">
          <div>
            <TestBadge
              failedLabel={text.testsFailed}
              noTestsLabel={text.noTests}
              passed={submission.testPassed}
              passedLabel={text.testsPassed}
            />
            {failedCases.length > 0 ? (
              <p className="mt-1.5 text-xs font-medium text-red-700">
                {failedCases.length} {text.failedCases}
              </p>
            ) : submission.feedback ? (
              <p className="mt-1.5 text-xs font-medium text-blue-700">
                {text.correctionsSaved}
              </p>
            ) : null}
          </div>
          <Link href={`/admin/submissions/${submission.id}`} className={primaryButtonClassName}>
            {text.review} →
          </Link>
        </div>
      </div>
    </article>
  );
}

function DiagramPreviewModal({
  onClose,
  submission,
}: {
  onClose: () => void;
  submission: AdminSubmission;
}) {
  const program = submission.diagramJson!;
  const [activeDiagramId, setActiveDiagramId] = useState("main");
  const activeFunction = program.functions.find(
    (flowFunction) => flowFunction.id === activeDiagramId,
  );
  const diagram = activeFunction ?? program.main;
  const availableFunctions = useMemo(
    () =>
      program.functions.map((flowFunction) => ({
        id: flowFunction.id,
        name: flowFunction.name,
        parameters: flowFunction.parameters,
        parameterDefinitions: flowFunction.parameterDefinitions,
      })),
    [program.functions],
  );
  const nodes = useMemo<FlowEditorNode[]>(
    () =>
      diagram.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          availableFunctions,
          onLabelChange: () => undefined,
          onConfigChange: () => undefined,
          onHandlePositionsChange: () => undefined,
        },
      })),
    [availableFunctions, diagram.nodes],
  );
  const edges = diagram.edges as FlowEditorEdge[];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-950/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagram-preview-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="flex h-[min(900px,94vh)] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl">
        <header className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Diagram preview · {submission.studentName}
            </p>
            <h2 id="diagram-preview-title" className="mt-1 truncate text-xl font-semibold">
              {submission.title}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Stored node positions and connections · Read only
            </p>
          </div>
          <div className="flex items-center gap-2">
            {program.functions.length > 0 ? (
              <select
                value={activeDiagramId}
                onChange={(event) => setActiveDiagramId(event.target.value)}
                className={inputClassName}
                aria-label="Select diagram"
              >
                <option value="main">Main diagram</option>
                {program.functions.map((flowFunction) => (
                  <option key={flowFunction.id} value={flowFunction.id}>
                    Function: {flowFunction.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className={iconButtonClassName}
              aria-label="Close diagram preview"
              title="Close preview"
            >
              ×
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 bg-neutral-100">
          <FlowNodeRenderProvider
            value={{
              availableFunctions,
              getExecution: () => undefined,
            }}
          >
            <ReactFlow<FlowEditorNode, FlowEditorEdge>
              key={activeDiagramId}
              nodes={nodes}
              edges={edges}
              nodeTypes={flowNodeComponents}
              edgeTypes={flowEdgeComponents}
              fitView
              fitViewOptions={{ padding: 0.2, minZoom: 0.2, maxZoom: 1.2 }}
              minZoom={0.1}
              maxZoom={2}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              zoomOnPinch
              zoomOnDoubleClick={false}
              className="flow-editor-canvas bg-neutral-100 [&_.react-flow__node]:pointer-events-none"
              attributionPosition="bottom-right"
            >
              <Background variant={BackgroundVariant.Lines} color="#d4d4d4" gap={24} />
              <Controls
                position="bottom-left"
                showInteractive={false}
                className="!rounded-lg !border !border-neutral-300 !bg-white !shadow-md [&_button]:!border-neutral-200"
              />
              <MiniMap<FlowEditorNode>
                position="bottom-right"
                nodeColor={(node) => getPreviewNodeColor(node.type)}
                pannable
                zoomable
                className="!rounded-lg !border !border-neutral-300 !bg-white !shadow-md"
              />
            </ReactFlow>
          </FlowNodeRenderProvider>
        </div>
      </section>
    </div>
  );
}

function getPreviewNodeColor(type: string) {
  if (type === "start" || type === "end") return "#bbf7d0";
  if (type === "decision") return "#fef08a";
  if (type === "input" || type === "output") return "#bfdbfe";
  if (type === "functionCall" || type === "return") return "#ddd6fe";
  return "#f5f5f5";
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const className =
    difficulty === "dificil"
      ? "bg-red-50 text-red-700 ring-red-200"
      : difficulty === "media"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>
      {difficulty}
    </span>
  );
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "danger" | "neutral" | "success";
  value: number;
}) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
      : tone === "danger"
        ? "border-red-200 bg-red-50/70 text-red-950"
        : "border-neutral-200 bg-white text-neutral-950";

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </article>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="col-span-full rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-12 text-center text-sm text-neutral-500">
      {label}
    </div>
  );
}

export function SubmissionReviewForm({
  feedback,
  status,
  submissionId,
}: {
  feedback: string | null;
  status: string;
  submissionId: number;
}) {
  return (
    <form
      action={updateSubmissionReviewAction}
      className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <input name="submissionId" type="hidden" value={submissionId} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Teacher review
        </p>
        <h2 className="mt-1 text-lg font-semibold">Corrections and feedback</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Explain the error, the expected approach, and what the student should change.
        </p>
      </div>
      <label className="text-sm font-semibold text-neutral-800">
        Review status
        <select
          name="status"
          className={`${inputClassName} mt-2 w-full`}
          defaultValue={status}
        >
          <option value="submitted">submitted</option>
          <option value="approved">approved</option>
          <option value="incomplete">incomplete</option>
          <option value="rejected">rejected</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-neutral-800">
        Corrections for the student
        <textarea
          name="feedback"
          className={`${inputClassName} mt-2 min-h-36 w-full resize-y`}
          defaultValue={feedback ?? ""}
          placeholder="Example: The loop stops one iteration early. Change the condition from i < n to i <= n and run the failed test again."
        />
      </label>
      <button className={primaryButtonClassName}>Save corrections</button>
    </form>
  );
}

export function TestResultPanel({
  result,
}: {
  result: import("@/lib/flow-test-runner").ExerciseTestRunResult | null;
}) {
  if (!result) {
    return (
      <section className={panelClassName}>
        <PanelTitle>Errors and automatic tests</PanelTitle>
        <p className="mt-3 text-sm text-neutral-600">
          This exercise has no automatic test result for this submission.
        </p>
      </section>
    );
  }

  return (
    <section className={panelClassName}>
      <PanelTitle>Errors and automatic tests</PanelTitle>
      <div className="mt-4 flex items-center justify-between rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-200">
        <p className="text-sm font-semibold text-neutral-800">
          {result.passedCount}/{result.total} passed
        </p>
        <span className={result.passed ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>
          {result.passed ? "All tests passed" : `${result.total - result.passedCount} need attention`}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {result.cases.map((testCase) => (
          <article
            key={testCase.name}
            className={testCase.passed ? "rounded-lg border border-emerald-200 bg-emerald-50/40 p-3" : "rounded-lg border border-red-200 bg-red-50/50 p-3"}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{testCase.name}</p>
              <span
                className={
                  testCase.passed
                    ? "rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                    : "rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800"
                }
              >
                {testCase.passed ? "passed" : "failed"}
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-600">
              Expected: {testCase.expectedOutputs.join(", ") || "-"}
            </p>
            <p className="text-xs text-neutral-600">
              Actual: {testCase.actualOutputs.join(", ") || "-"}
            </p>
            {!testCase.passed && testCase.message ? (
              <p className="mt-2 rounded-md bg-white/80 px-2.5 py-2 text-xs font-medium text-red-800 ring-1 ring-red-200">
                Error: {testCase.message}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminChrome({ children, user }: AdminChromeProps) {
  const { language, setLanguage } = useI18n();
  const text = copy[language];
  const nextLanguage = language === "es" ? "en" : "es";
  const pathname = usePathname();
  const navItems = [
    { href: "/admin/submissions", label: text.submissions, roles: ["teacher", "admin"] },
    { href: "/admin/users", label: text.users, roles: ["admin"] },
    { href: "/admin/exercises", label: text.exercises, roles: ["teacher", "admin"] },
  ];

  return (
    <main className="min-h-screen bg-[#f5f6f4] text-neutral-950 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-emerald-950/30 bg-[#12372a] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 lg:block lg:px-5 lg:py-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-white p-1.5 shadow-lg shadow-black/10">
              <Image src={logoImage} alt="FlowCode" className="h-9 w-auto object-contain" priority />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">{text.eyebrow}</p>
              <h1 className="truncate text-lg font-semibold">FlowCode</h1>
            </div>
          </div>
          <button
            type="button"
            aria-label={text.languageToggle}
            title={text.languageToggle}
            onClick={() => setLanguage(nextLanguage)}
            className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/10 lg:hidden"
          >
            {language.toUpperCase()}
          </button>
        </div>

        <div className="hidden px-4 pt-5 lg:block">
          <div className="rounded-xl border border-white/10 bg-white/8 p-3">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="mt-0.5 truncate text-xs text-emerald-100/70">@{user.username}</p>
            <span className="mt-3 inline-flex rounded-full bg-emerald-300/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-100 ring-1 ring-emerald-300/20">
              {user.role}
            </span>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-4 py-3 lg:grid lg:gap-1 lg:overflow-visible lg:px-4 lg:py-5">
          {navItems
            .filter((item) => item.roles.includes(user.role))
            .map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "whitespace-nowrap rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-emerald-950 shadow-sm lg:w-full"
                      : "whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-50/75 transition hover:bg-white/10 hover:text-white lg:w-full"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
        </nav>

        <div className="flex gap-2 px-4 pb-4 lg:hidden">
          <Link href="/" className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-center text-xs font-semibold transition hover:bg-white/10">
            {text.openEditor}
          </Link>
          <form action={logoutAction} className="flex-1">
            <button className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-50">
              {text.signOut}
            </button>
          </form>
        </div>

        <div className="mt-auto hidden grid-cols-2 gap-2 border-t border-white/10 p-4 lg:grid">
          <button
            type="button"
            aria-label={text.languageToggle}
            title={text.languageToggle}
            onClick={() => setLanguage(nextLanguage)}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold transition hover:bg-white/10"
          >
            {language.toUpperCase()}
          </button>
          <Link href="/" className="rounded-lg border border-white/15 px-3 py-2 text-center text-xs font-semibold transition hover:bg-white/10">
            {text.openEditor}
          </Link>
          <form action={logoutAction} className="col-span-2">
            <button className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-50">
              {text.signOut}
            </button>
          </form>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="sticky top-0 z-20 hidden border-b border-neutral-200/80 bg-[#f5f6f4]/90 px-6 py-4 backdrop-blur lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{text.activeRole}: {user.role}</p>
            <h2 className="mt-0.5 text-lg font-semibold">{text.title}</h2>
          </div>
          <p className="text-sm text-neutral-500">{text.signedIn} {user.fullName}</p>
        </header>
        <div className="grid w-full gap-5 px-4 py-5 sm:px-5 lg:px-6 lg:py-6 2xl:px-8">{children}</div>
      </section>
    </main>
  );
}

function PageHeader({
  count,
  help,
  title,
}: {
  count: number;
  help: string;
  title: string;
}) {
  const { language } = useI18n();
  const text = copy[language];

  return (
    <section className="rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-neutral-600">{help}</p>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-900">
          <span className="block text-xs font-semibold uppercase">
            {text.total}
          </span>
          <span className="text-2xl font-semibold">{count}</span>
        </div>
      </div>
    </section>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
      <h2 className="text-lg font-semibold">{children}</h2>
      <span
        className="h-2.5 w-2.5 rounded-full bg-emerald-500"
        aria-hidden="true"
      />
    </div>
  );
}

function AdminTable({
  children,
  emptyLabel,
  title,
}: {
  children: ReactNode;
  emptyLabel: string;
  title: string;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-neutral-300/80 bg-white shadow-md shadow-neutral-200/70">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/80 px-4 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs font-semibold text-neutral-600">
          {hasRows && Array.isArray(children) ? children.length : 0}
        </span>
      </div>
      <div className="max-h-[calc(100vh-18rem)] overflow-y-auto overflow-x-hidden">
        <table className="w-full table-fixed text-left text-sm">
          <tbody>
            {hasRows ? (
              children
            ) : (
              <tr>
                <td className="px-3 py-4 text-neutral-500">{emptyLabel}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "approved"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : status === "incomplete"
        ? "border-yellow-300 bg-yellow-50 text-yellow-900"
        : status === "rejected"
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-neutral-300 bg-neutral-50 text-neutral-700";

  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}

function TestBadge({
  failedLabel,
  noTestsLabel,
  passed,
  passedLabel,
}: {
  failedLabel: string;
  noTestsLabel: string;
  passed: boolean | null;
  passedLabel: string;
}) {
  const label =
    passed === null ? noTestsLabel : passed ? passedLabel : failedLabel;
  const className =
    passed === null
      ? "border-neutral-300 bg-neutral-50 text-neutral-600"
      : passed
        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
        : "border-red-300 bg-red-50 text-red-800";

  return (
    <span className={`mt-1 inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function formatDeadline(value: string) {
  return value.replace("T", " ");
}

const inputClassName =
  "rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm outline-none transition hover:border-neutral-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20";

const primaryButtonClassName =
  "rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0";

const secondaryButtonClassName =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0";

const panelClassName =
  "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-md sm:p-5";

const tableRowClassName =
  "border-t border-neutral-200 transition hover:bg-emerald-50/40";

const tableCellClassName = "break-words px-3 py-2 align-top";

const dangerButtonClassName =
  "rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2";

const iconButtonClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-xl leading-none text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600";
