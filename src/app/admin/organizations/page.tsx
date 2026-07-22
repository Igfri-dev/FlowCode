import { I18nProvider } from "@/features/i18n/I18nProvider";
import { requireAdmin } from "@/lib/auth";
import { listOrganizations } from "@/lib/admin-data";
import { AdminOrganizationsPage } from "../AdminPagesClient";

export default async function AdminOrganizationsRoute() {
  const user = await requireAdmin();
  const organizations = await listOrganizations();

  return (
    <I18nProvider>
      <AdminOrganizationsPage organizations={organizations} user={user} />
    </I18nProvider>
  );
}
