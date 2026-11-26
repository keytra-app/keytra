import { CreateKeyButton } from "@/components/keys/create-key-modal";
import { ExportModalButton } from "@/components/projects/export-modal";
import { ImportModalButton } from "@/components/projects/import-modal";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { Badge } from "@/components/ui/badge";
import { getProjectDetailBySlug } from "@/lib/projects/queries";

export default async function ProjectDetailPage({
  params,
}: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const { detail } = await getProjectDetailBySlug(slug);
  const { project, totalKeys, locales, namespaces } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">{project.name}</h1>
            <Badge mono className="text-zinc-400">
              {project.slug}
            </Badge>
          </div>

          {project.description && (
            <p className="max-w-2xl text-xs text-zinc-400">{project.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span>
              Ausgangssprache:{" "}
              <span className="font-mono text-zinc-300">{project.sourceLocale}</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span className="font-mono text-zinc-300">
              {totalKeys} {totalKeys === 1 ? "Key" : "Keys"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {detail.adminData && <CreateKeyButton projects={[{ ...project, namespaces }]} />}
          {detail.adminData && (
            <ImportModalButton
              projectId={project.id}
              sourceLocale={project.sourceLocale}
              locales={locales}
              namespaces={namespaces}
            />
          )}
          <ExportModalButton
            projectSlug={project.slug}
            sourceLocale={project.sourceLocale}
            locales={locales}
            namespaces={namespaces}
          />
        </div>
      </div>

      <ProjectTabs detail={detail} />
    </div>
  );
}
