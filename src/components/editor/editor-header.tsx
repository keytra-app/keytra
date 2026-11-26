"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ChevronDownIcon, PlusIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { EditorLocaleOption } from "@/lib/editor/queries";

export function EditorHeader({
  projectName,
  projectSlug,
  sourceLocale,
  activeLocale,
  locales,
  translatedCount,
  outdatedCount,
  totalCount,
  pendingSaves,
  isAdmin,
  onOpenCreateKey,
}: {
  projectName: string;
  projectSlug: string;
  sourceLocale: string;
  activeLocale: EditorLocaleOption;
  locales: EditorLocaleOption[];
  translatedCount: number;
  outdatedCount: number;
  totalCount: number;
  pendingSaves: number;
  isAdmin: boolean;
  onOpenCreateKey: () => void;
}) {
  const router = useRouter();

  return (
    <header className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-[#09090b] px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link
          href={`/projects/${projectSlug}`}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs text-zinc-400 transition-colors hover:border-zinc-800 hover:bg-[#111113] hover:text-zinc-100"
          title="Zurück zur Projekt-Übersicht"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Projekt</span>
        </Link>

        <span className="h-4 w-px shrink-0 bg-zinc-800" aria-hidden="true" />

        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/projects/${projectSlug}`}
            className="truncate text-sm font-medium tracking-tight text-zinc-100 transition-colors hover:text-white"
          >
            {projectName}
          </Link>
          <span className="hidden font-mono text-[11px] text-zinc-500 lg:inline">
            {sourceLocale} →
          </span>
        </div>

        <div className="relative shrink-0">
          <select
            aria-label="Zielsprache wechseln"
            value={activeLocale.code}
            onChange={(e) => {
              const nextCode = e.target.value;
              if (nextCode && nextCode !== activeLocale.code) {
                router.push(`/projects/${projectSlug}/translate/${encodeURIComponent(nextCode)}`);
              }
            }}
            className="h-8 appearance-none rounded-md border border-zinc-800 bg-[#111113] pr-7 pl-2.5 font-mono text-xs text-zinc-100 outline-none transition-colors hover:border-zinc-700 focus:border-zinc-500 cursor-pointer"
          >
            {locales.map((loc) => (
              <option key={loc.id} value={loc.code}>
                {loc.code} — {loc.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
        {pendingSaves > 0 && (
          <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
            Speichert …
          </span>
        )}

        <div
          className="flex items-center gap-2.5 rounded-md border border-zinc-800/90 bg-[#111113] px-2.5 py-1"
          title={`${translatedCount} von ${totalCount} übersetzt${outdatedCount > 0 ? `, ${outdatedCount} veraltet` : ""}`}
        >
          <ProgressBar
            translated={translatedCount}
            outdated={outdatedCount}
            total={totalCount}
            className="hidden h-1.5 w-16 bg-zinc-800 sm:flex"
          />
          <span className="font-mono text-[11px] tabular-nums text-zinc-300">
            <span className="text-zinc-100">{translatedCount}</span>
            <span className="text-zinc-600"> / </span>
            <span>{totalCount}</span>
            <span className="hidden font-sans text-zinc-500 md:inline"> übersetzt</span>
          </span>
        </div>

        {isAdmin && (
          <Button variant="primary" size="sm" onClick={onOpenCreateKey}>
            <PlusIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Key hinzufügen</span>
          </Button>
        )}
      </div>
    </header>
  );
}
