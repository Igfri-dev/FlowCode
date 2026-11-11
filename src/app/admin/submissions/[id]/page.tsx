import { notFound } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { AppHeader } from "@/components/ui/AppHeader";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { FlowWorkspace } from "@/features/flow/components/FlowWorkspace";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { getSubmissionReview } from "@/lib/admin-data";
import { SubmissionReviewForm, TestResultPanel } from "../../AdminPagesClient";
import { SubmissionCodePanel, SubmissionReviewHeader } from "./SubmissionReviewDetails";

type SubmissionReviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SubmissionReviewPage({ params }: SubmissionReviewPageProps) {
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

  const { code, diagramJson, feedback, testResult, ...metadata } = submission;

  return (
    <I18nProvider>
      <div className="app-shell flex min-h-screen flex-col">
        <AppHeader user={user} onLogout={logoutAction} />
        <main className="app-content flex min-w-0 flex-1 flex-col gap-6">
          <SubmissionReviewHeader submission={metadata} />
          <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <TestResultPanel result={testResult} />
            <SubmissionReviewForm
              feedback={feedback}
              status={submission.status}
              submissionId={submission.id}
            />
            {code ? <SubmissionCodePanel code={code} /> : null}
          </section>
          <div className="flex min-w-0 flex-1 border-t border-slate-200 pt-6">
            <FlowWorkspace databaseExercises={[]} initialProgram={diagramJson} isReviewMode />
          </div>
        </main>
      </div>
    </I18nProvider>
  );
}
