"use server";

import { revalidatePath } from "next/cache";
import { getPool } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ensureRuntimeSchema } from "@/lib/schema";

export async function deleteProjectAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "independent") {
    return;
  }

  await ensureRuntimeSchema();
  const id = Number(formData.get("projectId"));
  if (!Number.isInteger(id) || id <= 0) {
    return;
  }

  await getPool().execute(
    "DELETE FROM projects WHERE id = :id AND owner_id = :ownerId",
    { id, ownerId: user.id },
  );
  revalidatePath("/projects");
}

