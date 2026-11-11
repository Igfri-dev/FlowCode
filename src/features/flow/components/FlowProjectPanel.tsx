import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FlowProgram } from "@/types/flow";

export function FlowProjectPanel({
  currentProgram,
  project,
  onSaved,
}: {
  currentProgram: FlowProgram;
  project?: { id: number; title: string };
  onSaved?: () => boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(project?.title ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState(project?.id);

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
        savedProjectId ? `/api/projects/${savedProjectId}` : "/api/projects",
        {
          method: savedProjectId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: normalizedTitle,
            program: currentProgram,
          }),
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
      setSavedProjectId(result.id);
      const allChangesSaved = onSaved?.() ?? true;
      if (!allChangesSaved) {
        setMessage(
          "Proyecto guardado. Hay cambios nuevos pendientes de guardar.",
        );
      }
      if (!project && allChangesSaved) {
        router.push(`/projects/${result.id}`);
        router.refresh();
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el proyecto.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      data-panel="project-save"
      className="workspace-panel !p-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.04]"
    >
      <header className="flex items-center gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" />
            <path d="M7 3v6h9V3M7 21v-8h10v8" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="workspace-eyebrow text-emerald-700">
            Proyecto personal
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-slate-900">
            {project ? "Guardar cambios" : "Guardar este diagrama"}
          </h2>
        </div>
      </header>
      <div className="p-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <label
            htmlFor="flow-project-title"
            className="block text-xs font-semibold text-slate-700"
          >
            Nombre del proyecto
          </label>
          <input
            id="flow-project-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nombre del proyecto"
            aria-label="Nombre del proyecto"
            maxLength={180}
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 bg-slate-50/60 px-4 py-3">
        <Link href="/projects" className="fc-button fc-button--secondary">
          Mis proyectos
        </Link>
        <button
          type="button"
          onClick={() => void saveProject()}
          disabled={saving}
          className="fc-button fc-button--primary"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </footer>
      {message ? (
        <p
          className={`mx-4 my-3 rounded-lg border px-3 py-2 text-sm ${status === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
