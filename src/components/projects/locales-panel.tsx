"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ArrowUpRightIcon, GlobeIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useToast } from "@/components/ui/toast";
import { formatPercent } from "@/lib/format";
import { COMMON_LOCALES } from "@/lib/i18n/locales";
import { removeLocaleAction } from "@/lib/projects/actions";
import type { LocaleProgress } from "@/lib/projects/progress";
import { AddLocaleModal } from "./add-locale-modal";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function LocalesPanel({
  projectId,
  projectSlug,
  sourceLocale,
  totalKeys,
  locales,
  isAdmin,
}: {
  projectId: string;
  projectSlug: string;
  sourceLocale: string;
  totalKeys: number;
  locales: LocaleProgress[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [localeToRemove, setLocaleToRemove] = useState<LocaleProgress | null>(null);
  const [pendingRemove, startRemoveTransition] = useTransition();

  const existingCodes = new Set(
    [sourceLocale, ...locales.map((l) => l.code)].map((code) => code.toLowerCase()),
  );
  const availablePresets = COMMON_LOCALES.filter((l) => !existingCodes.has(l.code.toLowerCase()));

  function handleConfirmRemove() {
    if (!localeToRemove) return;
    const target = localeToRemove;

    startRemoveTransition(async () => {
      const result = await removeLocaleAction({ projectId, localeId: target.id });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast(`Sprache „${target.code}“ entfernt.`);
      setLocaleToRemove(null);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-medium text-zinc-100">Zielsprachen</h2>
          <p className="text-xs text-zinc-500">
            {locales.length === 0
              ? "Füge Zielsprachen hinzu, um Übersetzungen zu verwalten."
              : `${plural(locales.length, "Sprache", "Sprachen")} · ${plural(totalKeys, "Key", "Keys")} in Ausgangssprache ${sourceLocale}`}
          </p>
        </div>

        {isAdmin && (
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon className="h-3.5 w-3.5" />
            <span>Sprache hinzufügen</span>
          </Button>
        )}
      </div>

      {locales.length === 0 ? (
        <NoLocales isAdmin={isAdmin} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111113]">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] font-medium text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Sprache</th>
                <th className="px-4 py-2.5 font-medium">Fortschritt</th>
                <th className="px-3 py-2.5 text-right font-medium">Übersetzt</th>
                <th className="px-3 py-2.5 text-right font-medium">Veraltet</th>
                <th className="px-3 py-2.5 text-right font-medium">Fehlend</th>
                <th className="px-3 py-2.5 text-right font-medium">%</th>
                <th className="px-4 py-2.5 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {locales.map((locale) => (
                <LocaleRow
                  key={locale.id}
                  locale={locale}
                  editorHref={`/projects/${projectSlug}/translate/${encodeURIComponent(locale.code)}`}
                  onRemove={isAdmin ? () => setLocaleToRemove(locale) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <AddLocaleModal
          projectId={projectId}
          presets={availablePresets}
          onClose={() => setAddOpen(false)}
        />
      )}

      <ConfirmModal
        open={Boolean(localeToRemove)}
        onClose={() => setLocaleToRemove(null)}
        onConfirm={handleConfirmRemove}
        title="Sprache entfernen"
        description={
          localeToRemove
            ? `Alle gespeicherten Übersetzungen für ${localeToRemove.name} (${localeToRemove.code}) werden unwiderruflich gelöscht.`
            : undefined
        }
        confirmLabel="Unwiderruflich entfernen"
        pendingLabel="Entferne …"
        pending={pendingRemove}
      />
    </section>
  );
}

function NoLocales({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 bg-[#111113]/60 px-6 py-12 text-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-[#09090b] text-zinc-500">
        <GlobeIcon className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-200">Noch keine Zielsprachen</p>
        <p className="text-xs text-zinc-500">
          {isAdmin
            ? "Lege mindestens eine Zielsprache an, um mit dem Übersetzen zu starten."
            : "Ein Administrator hat für dieses Projekt noch keine Zielsprachen angelegt."}
        </p>
      </div>
    </div>
  );
}

function LocaleRow({
  locale,
  editorHref,
  onRemove,
}: {
  locale: LocaleProgress;
  editorHref: string;
  onRemove?: () => void;
}) {
  return (
    <tr className="transition-colors hover:bg-zinc-900/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex rounded border border-zinc-800 bg-[#09090b] px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
            {locale.code}
          </span>
          <span className="text-zinc-300">{locale.name}</span>
        </div>
      </td>

      <td className="w-44 px-4 py-3">
        <ProgressBar
          translated={locale.translated}
          outdated={locale.outdated}
          total={locale.total}
          className="flex h-1.5 w-full min-w-24 bg-zinc-800"
        />
      </td>

      <td className="px-3 py-3 text-right font-mono text-emerald-400/90 tabular-nums">
        {locale.translated}
      </td>
      <td className="px-3 py-3 text-right font-mono text-amber-400/90 tabular-nums">
        {locale.outdated}
      </td>
      <td className="px-3 py-3 text-right font-mono text-zinc-400 tabular-nums">
        {locale.missing}
      </td>
      <td className="px-3 py-3 text-right font-mono text-zinc-100 tabular-nums">
        {formatPercent(locale.percentage)}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <Link href={editorHref} className={buttonClasses({ variant: "secondary", size: "xs" })}>
            <span>Editor</span>
            <ArrowUpRightIcon className="h-3 w-3" />
          </Link>
          {onRemove && (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`Sprache ${locale.code} entfernen`}
              title="Sprache entfernen"
              onClick={onRemove}
              className="px-1.5 text-zinc-500 hover:text-red-400"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
