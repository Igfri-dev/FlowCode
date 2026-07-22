import { notFound, redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { AppHeader } from "@/components/ui/AppHeader";
import { FlowWorkspace } from "@/features/flow/components/FlowWorkspace";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { requireUser } from "@/lib/auth";
import { getSavedProject } from "@/lib/project-data";

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "independent") {
    redirect("/");
  }
  const { id: rawId } = await params;
  const id = Number(rawId);
  const project = Number.isInteger(id) && id > 0
    ? await getSavedProject(id, user.id)
    : null;
  if (!project) {
    notFound();
  }

  return (
    <I18nProvider>
      <div className="flex min-h-screen flex-col bg-neutral-100 text-neutral-950">
        <AppHeader user={user} onLogout={logoutAction} />
        <main className="flex flex-1 px-3 py-4 sm:px-4 lg:px-5 2xl:px-6">
          <FlowWorkspace
            databaseExercises={[]}
            enableProjectSaving
            project={{ id: project.id, title: project.title }}
            initialProgram={project.diagramJson}
          />
        </main>
      </div>
    </I18nProvider>
  );
}

