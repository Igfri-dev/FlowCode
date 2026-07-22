import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { AppHeader } from "@/components/ui/AppHeader";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { requireUser } from "@/lib/auth";
import { listSavedProjects } from "@/lib/project-data";
import { deleteProjectAction } from "./actions";

export default async function ProjectsPage() {
  const user = await requireUser();
  if (user.role !== "independent") {
    redirect("/");
  }
  const projects = await listSavedProjects(user.id);

  return (
    <I18nProvider>
      <div className="min-h-screen bg-neutral-100 text-neutral-950">
        <AppHeader user={user} onLogout={logoutAction} />
        <main className="mx-auto w-full max-w-6xl px-4 py-8">
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-300 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Espacio personal</p>
              <h1 className="mt-1 text-2xl font-semibold">Mis proyectos</h1>
              <p className="mt-1 text-sm text-neutral-600">Guarda tus diagramas y retómalos desde cualquier sesión.</p>
            </div>
            <Link href="/" className="rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800">
              Crear proyecto
            </Link>
          </div>
          {projects.length ? (
            <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <article key={project.id} className="rounded-xl border border-neutral-300 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Proyecto #{project.id}</p>
                  <h2 className="mt-2 text-lg font-semibold">{project.title}</h2>
                  <p className="mt-2 text-xs text-neutral-500">Actualizado {new Date(project.updatedAt).toLocaleString("es-CL")}</p>
                  <p className="mt-3 text-sm text-neutral-600">{project.diagramJson.main.nodes.length} bloques · {project.diagramJson.functions.length} funciones</p>
                  <div className="mt-5 flex gap-2">
                    <Link href={`/projects/${project.id}`} className="flex-1 rounded-md bg-neutral-950 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-neutral-800">Retomar</Link>
                    <form action={deleteProjectAction}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <button className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Eliminar</button>
                    </form>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-600">Todavía no has guardado proyectos.</div>
          )}
        </main>
      </div>
    </I18nProvider>
  );
}

