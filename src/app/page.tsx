import { AppHeader } from "@/components/ui/AppHeader";
import { logoutAction } from "@/app/actions/auth";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { FlowWorkspace } from "@/features/flow/components/FlowWorkspace";
import { requireUser } from "@/lib/auth";
import { listDatabaseExercises } from "@/lib/exercise-data";

export default async function Home() {
  const user = await requireUser();
  const databaseExercises = await listDatabaseExercises();

  return (
    <I18nProvider>
      <div className="flex min-h-screen flex-col bg-neutral-100 text-neutral-950">
        <AppHeader user={user} onLogout={logoutAction} />

        <main className="flex flex-1 px-3 py-4 sm:px-4 lg:px-5 2xl:px-6">
          <FlowWorkspace databaseExercises={databaseExercises} />
        </main>
      </div>
    </I18nProvider>
  );
}
