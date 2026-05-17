import { redirect } from "next/navigation";
import { requireTeacherOrAdmin } from "@/lib/auth";

export default async function AdminPage() {
  await requireTeacherOrAdmin();
  redirect("/admin/submissions");
}
