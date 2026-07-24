import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth";
import { AppHeader } from "@/components/ui/AppHeader";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { FlowWorkspace } from "@/features/flow/components/FlowWorkspace";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { getSubmissionReview } from "@/lib/admin-data";
import { SubmissionReviewForm, TestResultPanel } from "../../AdminPagesClient";

type SubmissionReviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SubmissionReviewPage({
  params,
}: SubmissionReviewPageProps) {
  const user = await requireTeacherOrAdmin();
  const { id } = await params;
  const submissionId = Number(id);

  if (!Number.isInteger(submissionId)) {
    notFound();
  }

  const submission = await getSubmissionReview(submissionId, user);

  if (!submission) {
    notFound();
  }

  return (
    <I18nProvider>
      <div className="flex min-h-screen flex-col bg-neutral-100 text-neutral-950">
        <AppHeader user={user} onLogout={logoutAction} />
        <header className="border-b border-neutral-200/80 bg-white px-4 py-4 shadow-sm shadow-neutral-200/70 sm:px-5 lg:px-6 2xl:px-8">
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <Link
                href="/admin/submissions"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0"
              >
                <BackArrowIcon />
                Back to submissions
              </Link>
              <div className="min-w-0 border-l border-neutral-200 pl-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Submission review <span className="text-neutral-400">#{submission.id}</span>
                </p>
                <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight">
                  {submission.title}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">
                {user.fullName} - {user.role}
              </span>
              <form action={logoutAction}>
                <button className="rounded-lg border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0">
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-3 text-xs">
            <MetadataPill label="Student">
              {submission.studentName} ({submission.studentUsername})
            </MetadataPill>
            <MetadataPill label="Exercise">
              {submission.exerciseTitle ?? "Free submission"}
            </MetadataPill>
            <MetadataPill label="Organization">
              {submission.organizationName ?? "Unassigned"}
            </MetadataPill>
            <MetadataPill label="Submitted">{submission.submittedAt}</MetadataPill>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 font-semibold capitalize ${getStatusClassName(submission.status)}`}
            >
              {submission.status}
            </span>
            {submission.submissionDeadline ? (
              <MetadataPill label={submission.canEdit ? "Editable until" : "Locked since"}>
                {submission.submissionDeadline.replace("T", " ")}
              </MetadataPill>
            ) : null}
          </div>
        </header>

        <section className="grid w-full gap-4 px-3 py-5 sm:px-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-6 2xl:px-8">
          <TestResultPanel result={submission.testResult} />
          <SubmissionReviewForm
            feedback={submission.feedback}
            status={submission.status}
            submissionId={submission.id}
          />
          {submission.code ? (
            <article className="min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm lg:col-span-2">
              <div className="border-b border-neutral-200 bg-neutral-50/80 px-4 py-3">
                <h2 className="text-lg font-semibold">Submitted JavaScript</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Compare the generated code with the diagram while reviewing errors.
                </p>
              </div>
              <pre className="mx-4 mb-4 mt-3 max-h-72 overflow-auto rounded-lg bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-100">
                <code>{submission.code}</code>
              </pre>
            </article>
          ) : null}
        </section>

        <main className="flex flex-1 border-t border-neutral-200/80 px-3 py-5 sm:px-4 lg:px-6 2xl:px-8">
          <FlowWorkspace
            databaseExercises={[]}
            initialProgram={submission.diagramJson}
            isReviewMode
          />
        </main>
      </div>
    </I18nProvider>
  );
}

function MetadataPill({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-neutral-700">
      <span className="font-semibold text-neutral-500">{label}:</span>
      <span className="font-medium">{children}</span>
    </span>
  );
}

function getStatusClassName(status: string) {
  if (status === "approved") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (status === "incomplete") {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }

  if (status === "rejected") {
    return "border-red-300 bg-red-50 text-red-800";
  }

  return "border-blue-300 bg-blue-50 text-blue-800";
}

function BackArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m15 18-6-6 6-6" />
      <path d="M9 12h10" />
    </svg>
  );
}
