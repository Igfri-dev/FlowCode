import Link from "next/link";
import { notFound } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
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

  const submission = await getSubmissionReview(submissionId);

  if (!submission) {
    notFound();
  }

  return (
    <I18nProvider>
      <div className="flex min-h-screen flex-col bg-neutral-100 text-neutral-950">
        <header className="border-b border-neutral-200 bg-white px-4 py-4 shadow-sm">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                href="/admin/submissions"
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Back to submissions
              </Link>
              <h1 className="mt-1 text-2xl font-semibold">
                {submission.title}
              </h1>
              <p className="text-sm text-neutral-600">
                {submission.studentName} ({submission.studentUsername}) -
                {submission.exerciseTitle ?? " Free submission"} -
                {submission.submittedAt}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-700">
                {user.fullName} - {user.role}
              </span>
              <form action={logoutAction}>
                <button className="rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        <section className="grid w-full gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-5 2xl:px-6">
          <TestResultPanel result={submission.testResult} />
          <SubmissionReviewForm
            feedback={submission.feedback}
            status={submission.status}
            submissionId={submission.id}
          />
        </section>

        <main className="flex flex-1 px-3 py-4 sm:px-4 lg:px-5 2xl:px-6">
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
