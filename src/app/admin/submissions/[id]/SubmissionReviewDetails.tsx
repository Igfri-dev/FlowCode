"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { AdminSubmission, SubmissionStatus } from "@/lib/admin-data";

type ReviewMetadata = Pick<
  AdminSubmission,
  | "id"
  | "title"
  | "status"
  | "studentName"
  | "studentUsername"
  | "exerciseTitle"
  | "organizationName"
  | "submittedAt"
  | "submissionDeadline"
  | "canEdit"
>;

const copy = {
  es: {
    back: "Volver a entregas",
    review: "Revisión de entrega",
    help: "Consulta los resultados, deja tus correcciones y explora el diagrama.",
    student: "Estudiante",
    exercise: "Ejercicio",
    organization: "Organización",
    submitted: "Fecha de entrega",
    freeSubmission: "Entrega libre",
    unassigned: "Sin asignar",
    editableUntil: "Editable hasta",
    lockedSince: "Cerrada desde",
    code: "Código entregado",
    codeHelp: "Compara el código JavaScript con el diagrama para revisar la solución.",
    statuses: {
      submitted: "Por revisar",
      approved: "Aprobada",
      incomplete: "Incompleta",
      rejected: "Rechazada",
    },
  },
  en: {
    back: "Back to submissions",
    review: "Submission review",
    help: "Check test results, share your feedback, and explore the diagram.",
    student: "Student",
    exercise: "Exercise",
    organization: "Organization",
    submitted: "Submitted on",
    freeSubmission: "Free submission",
    unassigned: "Unassigned",
    editableUntil: "Editable until",
    lockedSince: "Locked since",
    code: "Submitted code",
    codeHelp: "Compare the JavaScript code with the diagram to review the solution.",
    statuses: {
      submitted: "Awaiting review",
      approved: "Approved",
      incomplete: "Incomplete",
      rejected: "Rejected",
    },
  },
} as const;

export function SubmissionReviewHeader({ submission }: { submission: ReviewMetadata }) {
  const { language } = useI18n();
  const text = copy[language];

  return (
    <header className="min-w-0">
      <Link href="/admin/submissions" className="fc-button fc-button--secondary">
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m10 6-6 6 6 6M4 12h16" />
        </svg>
        {text.back}
      </Link>
      <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="workspace-eyebrow text-emerald-700">
            {text.review}
            <span className="ml-2 text-slate-400">#{submission.id}</span>
          </p>
          <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            {submission.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{text.help}</p>
        </div>
        <span
          className={`workspace-pill shrink-0 gap-2 border ${statusClassName[submission.status]}`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          {text.statuses[submission.status]}
        </span>
      </div>
      <dl className="workspace-panel mt-6 grid min-w-0 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetadataItem label={text.student}>
          {submission.studentName}
          <span className="mt-0.5 block text-xs font-normal text-slate-500">
            @{submission.studentUsername}
          </span>
        </MetadataItem>
        <MetadataItem label={text.exercise}>
          {submission.exerciseTitle ?? text.freeSubmission}
        </MetadataItem>
        <MetadataItem label={text.organization}>
          {submission.organizationName ?? text.unassigned}
        </MetadataItem>
        <MetadataItem label={text.submitted}>
          <time dateTime={submission.submittedAt.replace(" ", "T")}>{submission.submittedAt}</time>
        </MetadataItem>
        {submission.submissionDeadline ? (
          <MetadataItem label={submission.canEdit ? text.editableUntil : text.lockedSince}>
            <time dateTime={submission.submissionDeadline}>
              {submission.submissionDeadline.replace("T", " ")}
            </time>
          </MetadataItem>
        ) : null}
      </dl>
    </header>
  );
}

export function SubmissionCodePanel({ code }: { code: string }) {
  const { language } = useI18n();
  const text = copy[language];

  return (
    <article className="workspace-panel min-w-0 overflow-hidden p-0 xl:col-span-2">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{text.code}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{text.codeHelp}</p>
        </div>
        <span className="workspace-pill border border-slate-200 bg-slate-50 font-mono text-slate-500">
          JavaScript
        </span>
      </div>
      <pre className="m-4 max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 sm:m-5">
        <code>{code}</code>
      </pre>
    </article>
  );
}

function MetadataItem({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <dt className="workspace-eyebrow text-slate-500">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-slate-800">{children}</dd>
    </div>
  );
}

const statusClassName: Record<SubmissionStatus, string> = {
  submitted: "border-blue-100 bg-blue-50 text-blue-700",
  approved: "border-emerald-100 bg-emerald-50 text-emerald-700",
  incomplete: "border-amber-100 bg-amber-50 text-amber-800",
  rejected: "border-rose-100 bg-rose-50 text-rose-700",
};
