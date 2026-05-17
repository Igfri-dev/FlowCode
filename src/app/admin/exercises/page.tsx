import { I18nProvider } from "@/features/i18n/I18nProvider";
import { requireAdmin } from "@/lib/auth";
import { listAdminExercises } from "@/lib/admin-data";
import { AdminExercisesPage } from "../AdminPagesClient";

export default async function AdminExercisesRoute() {
  const user = await requireAdmin();
  const exercises = await listAdminExercises();

  return (
    <I18nProvider>
      <AdminExercisesPage exercises={exercises} user={user} />
    </I18nProvider>
  );
}
