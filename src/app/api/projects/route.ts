import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { isFlowProgram } from "@/lib/project-data";
import { ensureRuntimeSchema } from "@/lib/schema";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.mustChangePassword || user.role !== "independent") {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  await ensureRuntimeSchema();
  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    program?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 180) : "";

  if (!title || !isFlowProgram(body?.program)) {
    return NextResponse.json({ message: "El proyecto no es válido." }, { status: 400 });
  }

  const diagramJson = JSON.stringify(body.program);
  if (Buffer.byteLength(diagramJson, "utf8") > 2 * 1024 * 1024) {
    return NextResponse.json({ message: "El proyecto supera 2 MB." }, { status: 413 });
  }

  const [result] = await getPool().execute(
    `INSERT INTO projects (owner_id, title, diagram_json)
     VALUES (:ownerId, :title, :diagramJson)`,
    { ownerId: user.id, title, diagramJson },
  );

  return NextResponse.json({
    ok: true,
    id: Number((result as { insertId: number }).insertId),
  });
}

