import { I18nProvider } from "@/features/i18n/I18nProvider";
import { requireAdmin } from "@/lib/auth";
import { listAdminUsers } from "@/lib/admin-data";
import { AdminUsersPage } from "../AdminPagesClient";

export default async function AdminUsersRoute() {
  const user = await requireAdmin();
  const users = await listAdminUsers();

  return (
    <I18nProvider>
      <AdminUsersPage user={user} users={users} />
    </I18nProvider>
  );
}
