import { logoutAction } from "@/app/actions/auth";
import { AppHeader } from "@/components/ui/AppHeader";
import { FlowWorkspace } from "@/features/flow/components/FlowWorkspace";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { requireUser } from "@/lib/auth";
import { listDatabaseExercises } from "@/lib/exercise-data";

export default async function Home() {
  const user = await requireUser();
  const databaseExercises =
    user.role === "independent"
      ? []
      : await listDatabaseExercises(user.organizationId);

  return (
    <I18nProvider>
      <div className="app-shell flex min-h-screen flex-col">
        <AppHeader user={user} onLogout={logoutAction} />

        <main className="app-content flex flex-1">
          <FlowWorkspace
            key={`workspace-${user.id}`}
            draftStorageKey={`flowcode:user-${user.id}:workspace`}
            allowSubmissions={user.role === "student"}
            databaseExercises={databaseExercises}
            enableProjectSaving={user.role === "independent"}
          />
        </main>
      </div>
    </I18nProvider>
  );
}
