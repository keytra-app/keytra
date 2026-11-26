import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatPercent } from "@/lib/format";
import type { DashboardProject } from "@/lib/projects/queries";

export function ProjectCard({ project }: { project: DashboardProject }) {
  return (
    <article className="group relative flex flex-col justify-between gap-4 rounded-lg border border-zinc-800 bg-[#111113] p-5 transition-colors hover:border-zinc-700">
      <Link
        href={`/projects/${project.slug}`}
        aria-label={`Projekt ${project.name} öffnen`}
        className="absolute inset-0 rounded-lg outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
      />

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h2 className="truncate text-sm font-semibold text-zinc-100 transition-colors group-hover:text-white">
              {project.name}
            </h2>
            <p className="truncate font-mono text-xs text-zinc-500">{project.slug}</p>
          </div>
          <ArrowUpRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300" />
        </div>

        {project.description && (
          <p className="line-clamp-1 text-xs text-zinc-400">{project.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-500">
          <Badge mono>{project.sourceLocale}</Badge>
          <span className="font-mono text-[11px] text-zinc-400">
            {project.totalKeys} {project.totalKeys === 1 ? "Key" : "Keys"}
          </span>
          {project.translatorAccess === "selected" && (
            <span className="text-[11px] text-zinc-500">· Eingeschränkt</span>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800/80 pt-3.5">
        {project.locales.length === 0 ? (
          <p className="text-xs text-zinc-500">Noch keine Zielsprachen angelegt</p>
        ) : (
          <ul className="space-y-1.5">
            {project.locales.map((locale) => (
              <li key={locale.id}>
                <Link
                  href={`/projects/${project.slug}/translate/${encodeURIComponent(locale.code)}`}
                  className="relative z-10 flex items-center gap-3 rounded px-1.5 py-1 -mx-1.5 transition-colors hover:bg-zinc-900"
                >
                  <span className="w-12 shrink-0 truncate font-mono text-xs text-zinc-200">
                    {locale.code}
                  </span>

                  <ProgressBar
                    translated={locale.translated}
                    outdated={locale.outdated}
                    total={locale.total}
                    className="flex h-1.5 flex-1 bg-zinc-800/90"
                  />

                  <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] tabular-nums">
                    <span
                      className={
                        locale.percentage === 100 && locale.total > 0
                          ? "text-emerald-400"
                          : "text-zinc-300"
                      }
                    >
                      {formatPercent(locale.percentage)}
                    </span>
                    {locale.outdated > 0 && (
                      <span className="text-amber-400/90" title={`${locale.outdated} veraltet`}>
                        ~{locale.outdated}
                      </span>
                    )}
                    {locale.missing > 0 && (
                      <span className="text-zinc-500" title={`${locale.missing} fehlend`}>
                        -{locale.missing}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
