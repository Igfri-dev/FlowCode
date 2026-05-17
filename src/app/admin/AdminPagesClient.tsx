"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth";
import {
  createExerciseAction,
  createUserAction,
  updateSubmissionReviewAction,
} from "@/app/admin/actions";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { SessionUser } from "@/lib/auth";
import type {
  AdminExercise,
  AdminSubmission,
  AdminUser,
} from "@/lib/admin-data";
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
    exerciseTitle: "Titulo",
    description: "Descripcion",
    objective: "Objetivo",
    starterCode:
      "JavaScript inicial opcional. Se guardara, pero no se mostrara como solucion en el importador.",
    testCases:
      'Tests en JSON. Ejemplo: [{"name":"caso 1","inputs":[5],"expectedOutputs":["10"]}]',
    tags: "Etiquetas separadas por coma",
    users: "Usuarios",
    usersHelp: "Gestiona las cuentas de alumnos, profesores y administradores.",
    exercises: "Ejercicios",
    exercisesHelp: "Crea desafios que apareceran en el modo ejercicios.",
    submissions: "Entregas",
    submissionsHelp: "Revisa diagramas enviados y ejecutalos para evaluarlos.",
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
    exerciseTitle: "Title",
    description: "Description",
    objective: "Objective",
    starterCode:
      "Optional starter JavaScript. It will be saved but not shown as the solution in the import panel.",
    testCases:
      'JSON tests. Example: [{"name":"case 1","inputs":[5],"expectedOutputs":["10"]}]',
    tags: "Tags separated by comma",
    users: "Users",
    usersHelp: "Manage student, teacher, and administrator accounts.",
    exercises: "Exercises",
    exercisesHelp: "Create challenges that appear in exercise mode.",
    submissions: "Submissions",
    submissionsHelp: "Review submitted diagrams and run them for evaluation.",
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

  return (
    <AdminChrome user={user}>
      <PageHeader
        count={exercises.length}
        help={text.exercisesHelp}
        title={text.exercises}
      />
      <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className={panelClassName}>
          <PanelTitle>{text.createExercise}</PanelTitle>
          <form action={createExerciseAction} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
              <input
                name="title"
                placeholder={text.exerciseTitle}
                className={inputClassName}
                required
              />
              <select
                name="difficulty"
                className={inputClassName}
                defaultValue="facil"
              >
                <option value="facil">facil</option>
                <option value="media">media</option>
                <option value="dificil">dificil</option>
              </select>
            </div>
            <textarea
              name="description"
              placeholder={text.description}
              className={`${inputClassName} min-h-20`}
              required
            />
            <textarea
              name="objective"
              placeholder={text.objective}
              className={`${inputClassName} min-h-20`}
              required
            />
            <textarea
              name="starterCode"
              placeholder={text.starterCode}
              className={`${inputClassName} min-h-28 font-mono`}
            />
            <textarea
              name="testCases"
              placeholder={text.testCases}
              className={`${inputClassName} min-h-28 font-mono`}
            />
            <input name="tags" placeholder={text.tags} className={inputClassName} />
            <button className={primaryButtonClassName}>
              {text.createExercise}
            </button>
          </form>
        </section>

        <AdminTable emptyLabel={text.noRows} title={text.exercises}>
          {exercises.map((item) => (
            <tr key={item.id} className={tableRowClassName}>
              <td className={tableCellClassName}>{item.title}</td>
              <td className={tableCellClassName}>{item.difficulty}</td>
              <td className={tableCellClassName}>
                {item.hasTests ? text.tests : text.noTests}
              </td>
              <td className={tableCellClassName}>{item.createdBy ?? "-"}</td>
            </tr>
          ))}
        </AdminTable>
      </div>
    </AdminChrome>
  );
}

export function AdminSubmissionsPage({
  submissions,
  user,
}: AdminSubmissionsPageProps) {
  const { language } = useI18n();
  const text = copy[language];

  return (
    <AdminChrome user={user}>
      <PageHeader
        count={submissions.length}
        help={text.submissionsHelp}
        title={text.submissions}
      />
      <AdminTable emptyLabel={text.noRows} title={text.submissions}>
        {submissions.map((item) => (
          <tr key={item.id} className={tableRowClassName}>
            <td className={tableCellClassName}>
              <span className="font-medium">{item.title}</span>
              <span className="block text-xs text-neutral-500">
                {item.exerciseTitle ?? text.freeSubmission}
              </span>
            </td>
            <td className={tableCellClassName}>
              <span className="font-medium">{item.studentName}</span>
              <span className="block text-xs text-neutral-500">
                {item.studentUsername}
              </span>
            </td>
            <td className={tableCellClassName}>{item.submittedAt}</td>
            <td className={tableCellClassName}>
              <StatusBadge status={item.status} />
              <TestBadge
                failedLabel={text.testsFailed}
                noTestsLabel={text.noTests}
                passed={item.testPassed}
                passedLabel={text.testsPassed}
              />
            </td>
            <td className={tableCellClassName}>
              <Link
                href={`/admin/submissions/${item.id}`}
                className="inline-flex rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-100"
              >
                {text.review}
              </Link>
            </td>
          </tr>
        ))}
      </AdminTable>
    </AdminChrome>
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
      className="grid gap-3 rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70"
    >
      <input name="submissionId" type="hidden" value={submissionId} />
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
        Feedback
        <textarea
          name="feedback"
          className={`${inputClassName} mt-2 min-h-24 w-full`}
          defaultValue={feedback ?? ""}
          placeholder="Optional feedback for the student"
        />
      </label>
      <button className={primaryButtonClassName}>Save review</button>
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
        <PanelTitle>Automatic tests</PanelTitle>
        <p className="mt-3 text-sm text-neutral-600">
          This exercise has no automatic test result for this submission.
        </p>
      </section>
    );
  }

  return (
    <section className={panelClassName}>
      <PanelTitle>Automatic tests</PanelTitle>
      <p className="mt-3 text-sm font-semibold text-neutral-800">
        {result.passedCount}/{result.total} passed
      </p>
      <div className="mt-3 grid gap-2">
        {result.cases.map((testCase) => (
          <article
            key={testCase.name}
            className="rounded-md border border-neutral-200 bg-neutral-50 p-3"
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
    { href: "/admin/exercises", label: text.exercises, roles: ["admin"] },
  ];

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/95 shadow-sm shadow-neutral-200/70 backdrop-blur">
        <div className="flex h-auto w-full flex-col gap-3 px-4 py-3 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src={logoImage}
                alt=""
                aria-hidden="true"
                className="h-16 w-auto shrink-0 object-contain"
                priority
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-emerald-700">
                  {text.eyebrow}
                </p>
                <h1 className="truncate text-2xl font-semibold text-neutral-950">
                  {text.title}
                </h1>
                <p className="mt-0.5 truncate text-sm text-neutral-600">
                  {text.signedIn} {user.fullName} ({user.username})
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm">
                {text.activeRole}: {user.role}
              </span>
              <button
                type="button"
                aria-label={text.languageToggle}
                title={text.languageToggle}
                onClick={() => setLanguage(nextLanguage)}
                className={secondaryButtonClassName}
              >
                {language.toUpperCase()}
              </button>
              <Link href="/" className={secondaryButtonClassName}>
                {text.openEditor}
              </Link>
              <form action={logoutAction}>
                <button className={primaryButtonClassName}>{text.signOut}</button>
              </form>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1">
            {navItems
              .filter((item) => item.roles.includes(user.role))
              .map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      isActive ? activeNavButtonClassName : secondaryButtonClassName
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>
        </div>
      </header>

      <div className="grid w-full gap-4 px-4 py-5 lg:px-6">{children}</div>
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

const inputClassName =
  "rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm outline-none transition hover:border-neutral-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20";

const primaryButtonClassName =
  "rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0";

const secondaryButtonClassName =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0";

const activeNavButtonClassName =
  "rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white shadow-sm";

const panelClassName =
  "rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50";

const tableRowClassName =
  "border-t border-neutral-200 transition hover:bg-emerald-50/40";

const tableCellClassName = "break-words px-3 py-2 align-top";
