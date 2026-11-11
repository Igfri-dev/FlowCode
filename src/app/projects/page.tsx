import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { AppHeader } from "@/components/ui/AppHeader";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { requireUser } from "@/lib/auth";
import { listSavedProjects } from "@/lib/project-data";
import type { FlowProgram } from "@/types/flow";
import { deleteProjectAction } from "./actions";

export default async function ProjectsPage() {
  const user = await requireUser();
  if (user.role !== "independent") {
    redirect("/");
  }
  const projects = await listSavedProjects(user.id);

  return (
    <I18nProvider>
      <div className="app-shell min-h-screen">
        <AppHeader user={user} onLogout={logoutAction} />
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="workspace-eyebrow text-emerald-700">Espacio personal</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Mis proyectos
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                Un lugar para tus ideas. Guarda tus diagramas y continúa donde
                los dejaste.
              </p>
            </div>
            <Link
              href="/"
              className="fc-button fc-button--primary self-start sm:self-auto"
            >
              <PlusIcon />
              Crear proyecto
            </Link>
          </div>
          {projects.length ? (
            <section aria-label="Proyectos guardados" className="mt-9">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-700">
                  Diagramas guardados
                </h2>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
                  {projects.length}
                </span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <article
                    key={project.id}
                    className="workspace-panel flex min-w-0 flex-col overflow-hidden p-0 transition-colors hover:border-slate-300"
                  >
                    <Link
                      href={`/projects/${project.id}`}
                      aria-label={`Abrir ${project.title}`}
                      className="block border-b border-slate-100 bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                    >
                      <ProjectDiagramPreview program={project.diagramJson} />
                    </Link>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                        Proyecto #{project.id}
                      </p>
                      <h3 className="mt-2 break-words text-lg font-semibold tracking-tight text-slate-950">
                        <Link
                          href={`/projects/${project.id}`}
                          className="rounded-sm transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                          {project.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Actualizado{" "}
                        <time dateTime={project.updatedAt}>
                          {new Date(project.updatedAt).toLocaleString("es-CL", {
                            timeZone: "America/Santiago",
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2 py-1">
                          {project.diagramJson.main.nodes.length +
                            project.diagramJson.functions.reduce(
                              (total, flowFunction) =>
                                total + flowFunction.nodes.length,
                              0,
                            )}{" "}
                          bloques
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-1">
                          {project.diagramJson.functions.length} funciones
                        </span>
                      </div>
                      <div className="mt-auto flex gap-2 pt-5">
                        <Link
                          href={`/projects/${project.id}`}
                          className="fc-button fc-button--secondary flex-1"
                        >
                          Retomar <ArrowIcon />
                        </Link>
                        <form action={deleteProjectAction}>
                          <input
                            type="hidden"
                            name="projectId"
                            value={project.id}
                          />
                          <button
                            aria-label={`Eliminar ${project.title}`}
                            className="fc-button fc-button--danger"
                          >
                            Eliminar
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="workspace-panel mt-9 flex flex-col items-center border-dashed px-6 py-14 text-center sm:py-20">
              <span
                aria-hidden="true"
                className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700"
              >
                <EmptyProjectIcon />
              </span>
              <h2 className="mt-6 text-xl font-semibold tracking-tight text-slate-950">
                Tu próximo algoritmo empieza aquí
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                Todavía no has guardado proyectos. Crea un diagrama, conecta los
                bloques y guárdalo para retomarlo después.
              </p>
              <Link href="/" className="fc-button fc-button--primary mt-6">
                <PlusIcon />
                Crear mi primer proyecto
              </Link>
            </section>
          )}
        </main>
      </div>
    </I18nProvider>
  );
}

function ProjectDiagramPreview({ program }: { program: FlowProgram }) {
  const nodes = program.main.nodes
    .filter(
      (node) =>
        Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y),
    )
    .slice(0, 32);
  if (!nodes.length) {
    return (
      <div
        aria-hidden="true"
        className="flex h-36 items-center justify-center gap-2 text-xs font-medium text-slate-400"
      >
        <EmptyProjectIcon />
        Lienzo en blanco
      </div>
    );
  }
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const maxX = Math.max(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxY = Math.max(...nodes.map((node) => node.position.y));
  const scale = Math.min(
    240 / Math.max(120, maxX - minX),
    80 / Math.max(80, maxY - minY),
  );
  const positions = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: 160 + (node.position.x - (minX + maxX) / 2) * scale,
        y: 72 + (node.position.y - (minY + maxY) / 2) * scale,
      },
    ]),
  );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 144"
      className="h-36 w-full"
      fill="none"
    >
      {program.main.edges.map((edge) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        return source && target ? (
          <path
            key={edge.id}
            d={`M${source.x} ${source.y}V${(source.y + target.y) / 2}H${target.x}V${target.y}`}
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
        ) : null;
      })}
      {nodes.map((node) => {
        const point = positions.get(node.id)!;
        if (node.type === "decision")
          return (
            <path
              key={node.id}
              d={`m${point.x} ${point.y - 10} 16 10-16 10-16-10Z`}
              fill="#fffbeb"
              stroke="#d97706"
              strokeWidth="1.25"
            />
          );
        const terminal = node.type === "start" || node.type === "end";
        return (
          <rect
            key={node.id}
            x={point.x - 16}
            y={point.y - 8}
            width="32"
            height="16"
            rx={terminal ? 8 : 3}
            fill={terminal ? "#ecfdf5" : "#ffffff"}
            stroke={terminal ? "#059669" : "#94a3b8"}
            strokeWidth="1.25"
          />
        );
      })}
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

function EmptyProjectIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="8" height="5" rx="2.5" />
      <path d="M6 7v5h12v5" />
      <rect x="14" y="17" width="8" height="5" rx="1" />
    </svg>
  );
}
