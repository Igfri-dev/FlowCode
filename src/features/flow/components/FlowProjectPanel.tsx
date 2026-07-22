import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FlowProgram } from "@/types/flow";

export function FlowProjectPanel({
  currentProgram,
  project,
}: {
  currentProgram: FlowProgram;
  project?: { id: number; title: string };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(project?.title ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [saving, setSaving] = useState(false);

  async function saveProject() {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setStatus("error");
      setMessage("Escribe un nombre para el proyecto.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        project ? `/api/projects/${project.id}` : "/api/projects",
        {
          method: project ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: normalizedTitle, program: currentProgram }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        id?: number;
        message?: string;
      } | null;

      if (!response.ok || !result?.id) {
        throw new Error(result?.message ?? "No se pudo guardar el proyecto.");
      }

      setStatus("success");
      setMessage(project ? "Proyecto actualizado." : "Proyecto guardado.");
      if (!project) {
        router.push(`/projects/${result.id}`);
        router.refresh();
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el proyecto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-emerald-300 bg-white p-4 shadow-md shadow-emerald-950/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Proyecto personal</p>
          <h2 className="mt-1 text-base font-semibold">{project ? "Guardar cambios" : "Guardar este diagrama"}</h2>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nombre del proyecto"
            maxLength={180}
            className="mt-3 w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>
        <div className="flex gap-2">
          <Link href="/projects" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">Mis proyectos</Link>
          <button type="button" onClick={() => void saveProject()} disabled={saving} className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
      {message ? <p className={`mt-3 rounded-md border px-3 py-2 text-sm ${status === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}>{message}</p> : null}
    </section>
  );
}

