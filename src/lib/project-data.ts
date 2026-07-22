import type { RowDataPacket } from "mysql2/promise";
import type { FlowProgram } from "@/types/flow";
import { queryOne, queryRows } from "@/lib/db";
import { ensureRuntimeSchema } from "@/lib/schema";

export type SavedProject = {
  id: number;
  title: string;
  diagramJson: FlowProgram;
  createdAt: string;
  updatedAt: string;
};

type ProjectRow = RowDataPacket & {
  id: number;
  title: string;
  diagram_json: string | FlowProgram;
  created_at: Date;
  updated_at: Date;
};

export async function listSavedProjects(ownerId: number) {
  await ensureRuntimeSchema();
  const rows = await queryRows<ProjectRow>(
    `SELECT id, title, diagram_json, created_at, updated_at
     FROM projects
     WHERE owner_id = :ownerId
     ORDER BY updated_at DESC, id DESC`,
    { ownerId },
  );

  return rows.map(mapProject);
}

export async function getSavedProject(id: number, ownerId: number) {
  await ensureRuntimeSchema();
  const row = await queryOne<ProjectRow>(
    `SELECT id, title, diagram_json, created_at, updated_at
     FROM projects
     WHERE id = :id AND owner_id = :ownerId
     LIMIT 1`,
    { id, ownerId },
  );

  return row ? mapProject(row) : null;
}

export function isFlowProgram(value: unknown): value is FlowProgram {
  if (!value || typeof value !== "object") {
    return false;
  }

  const program = value as {
    main?: { nodes?: unknown; edges?: unknown };
    functions?: unknown;
  };

  return Boolean(
    program.main &&
      Array.isArray(program.main.nodes) &&
      Array.isArray(program.main.edges) &&
      Array.isArray(program.functions),
  );
}

function mapProject(row: ProjectRow): SavedProject {
  return {
    id: row.id,
    title: row.title,
    diagramJson:
      typeof row.diagram_json === "string"
        ? (JSON.parse(row.diagram_json) as FlowProgram)
        : row.diagram_json,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

