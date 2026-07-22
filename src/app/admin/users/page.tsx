import { I18nProvider } from "@/features/i18n/I18nProvider";
import { requireTeacherOrAdmin } from "@/lib/auth";
import {
  listAdminUsers,
  listOrganizations,
  listUserGroups,
} from "@/lib/admin-data";
import { AdminUsersPage } from "../AdminPagesClient";

export default async function AdminUsersRoute() {
  const user = await requireTeacherOrAdmin();
  const [users, organizations, groups] = await Promise.all([
    listAdminUsers(user),
    user.role === "admin" ? listOrganizations() : Promise.resolve([]),
    listUserGroups(user),
  ]);

  return (
    <I18nProvider>
      <AdminUsersPage
        groups={groups}
        organizations={organizations}
        user={user}
        users={users}
      />
    </I18nProvider>
  );
}
