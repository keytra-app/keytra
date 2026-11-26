import { CreateProjectModalButton } from "@/components/dashboard/create-project-modal";
import { ProjectCard } from "@/components/dashboard/project-card";
import { CreateKeyButton } from "@/components/keys/create-key-modal";
import { GlobeIcon } from "@/components/ui/icons";
import { requireAuth } from "@/lib/auth/session";
import { getAccessibleProjects } from "@/lib/projects/queries";

export default async function DashboardPage() {
  const user = await requireAuth();
  const projectList = await getAccessibleProjects(user);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Projekte</h1>
          <p className="text-xs text-zinc-400">
            {projectList.length === 0
              ? user.role === "admin"
                ? "Lege dein erstes Projekt an, um Keys und Zielsprachen zu verwalten."
                : "Dir wurden noch keine Projekte freigegeben."
              : `${projectList.length} ${projectList.length === 1 ? "Projekt" : "Projekte"} · Klick auf eine Sprache öffnet den Editor`}
          </p>
        </div>

        {user.role === "admin" && (
          <div className="flex items-center gap-2">
            <CreateKeyButton projects={projectList} selectableProject />
            <CreateProjectModalButton />
          </div>
        )}
      </div>

      {projectList.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 bg-[#111113]/60 px-6 py-16 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-[#09090b] text-zinc-500">
            <GlobeIcon className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-200">Keine Projekte vorhanden</p>
            <p className="max-w-xs text-xs text-zinc-500">
              {user.role === "admin"
                ? "Erstelle ein Projekt, füge Zielsprachen hinzu und synchronisiere deine JSON-Dateien per API."
                : "Bitte einen Administrator darum, dir Zugriff auf ein Projekt zu geben."}
            </p>
          </div>
          {user.role === "admin" && (
            <div className="pt-1">
              <CreateProjectModalButton />
            </div>
          )}
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2">
          {projectList.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      )}
    </div>
  );
}
