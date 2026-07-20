import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { AppHeader } from "@/components/ui/AppHeader";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { FlowWorkspace } from "@/features/flow/components/FlowWorkspace";
import { requireUser } from "@/lib/auth";
import { getStudentEditableSubmission } from "@/lib/admin-data";
import { listDatabaseExercises } from "@/lib/exercise-data";

type EditSubmissionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditSubmissionPage({
  params,
}: EditSubmissionPageProps) {
  const user = await requireUser();

  if (user.role !== "student") {
    redirect("/admin/submissions");
  }

  const { id } = await params;
  const submissionId = Number(id);

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    notFound();
  }

  const submission = await getStudentEditableSubmission(submissionId, user.id);

  if (!submission) {
    notFound();
  }

  if (!submission.canEdit) {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-100 px-4 text-neutral-950">
        <section className="w-full max-w-lg rounded-xl border border-amber-200 bg-white p-6 text-center shadow-lg shadow-neutral-200/70">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Submission locked
          </p>
          <h1 className="mt-2 text-2xl font-semibold">The deadline has passed</h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            {submission.exerciseTitle ?? submission.title} can no longer be changed.
            {submission.submissionDeadline
              ? ` The deadline was ${submission.submissionDeadline.replace("T", " ")}.`
              : ""}
          </p>
          <Link
            href="/student/submissions"
            className="mt-5 inline-flex rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to my submissions
          </Link>
        </section>
      </main>
    );
  }

  const databaseExercises = await listDatabaseExercises();

  return (
    <I18nProvider>
      <div className="flex min-h-screen flex-col bg-neutral-100 text-neutral-950">
        <AppHeader user={user} onLogout={logoutAction} />
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <div className="mx-auto flex w-full items-center justify-between gap-3">
            <p>
              <span className="font-semibold">Editing:</span> {submission.title}
            </p>
            <Link
              href="/student/submissions"
              className="font-semibold text-emerald-800 hover:text-emerald-950"
            >
              Cancel and return
            </Link>
          </div>
        </div>
        <main className="flex flex-1 px-3 py-4 sm:px-4 lg:px-5 2xl:px-6">
          <FlowWorkspace
            databaseExercises={databaseExercises}
            editingSubmission={{
              id: submission.id,
              title: submission.title,
              submissionDeadline: submission.submissionDeadline,
            }}
            initialExerciseId={submission.exerciseId}
            initialProgram={submission.diagramJson}
          />
        </main>
      </div>
    </I18nProvider>
  );
}
