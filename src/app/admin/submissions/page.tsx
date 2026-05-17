import { I18nProvider } from "@/features/i18n/I18nProvider";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { listAdminSubmissions } from "@/lib/admin-data";
import { AdminSubmissionsPage } from "../AdminPagesClient";

export default async function AdminSubmissionsRoute() {
  const user = await requireTeacherOrAdmin();
  const submissions = await listAdminSubmissions();

  return (
    <I18nProvider>
      <AdminSubmissionsPage submissions={submissions} user={user} />
    </I18nProvider>
  );
}
