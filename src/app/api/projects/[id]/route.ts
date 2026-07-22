import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { isFlowProgram } from "@/lib/project-data";
import { ensureRuntimeSchema } from "@/lib/schema";

export async function PUT(
  request: Request,
  context: RouteContext<"/api/projects/[id]">,
) {
  const user = await getCurrentUser();

  if (!user || user.mustChangePassword || user.role !== "independent") {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  await ensureRuntimeSchema();
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    program?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 180) : "";

  if (!Number.isInteger(id) || id <= 0 || !title || !isFlowProgram(body?.program)) {
    return NextResponse.json({ message: "El proyecto no es válido." }, { status: 400 });
  }

  const diagramJson = JSON.stringify(body.program);
  if (Buffer.byteLength(diagramJson, "utf8") > 2 * 1024 * 1024) {
    return NextResponse.json({ message: "El proyecto supera 2 MB." }, { status: 413 });
  }

  const [result] = await getPool().execute(
    `UPDATE projects
     SET title = :title, diagram_json = :diagramJson, updated_at = NOW()
     WHERE id = :id AND owner_id = :ownerId`,
    { id, ownerId: user.id, title, diagramJson },
  );
  const affectedRows = Number((result as { affectedRows: number }).affectedRows);

  if (!affectedRows) {
    return NextResponse.json({ message: "Proyecto no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}

