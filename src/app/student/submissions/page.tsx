import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listStudentSubmissions } from "@/lib/admin-data";
import { StudentSubmissionsClient } from "./StudentSubmissionsClient";

export default async function StudentSubmissionsPage() {
  const user = await requireUser();

  if (user.role !== "student") {
    redirect("/admin/submissions");
  }

  const submissions = await listStudentSubmissions(user.id);

  return <StudentSubmissionsClient submissions={submissions} user={user} />;
}
