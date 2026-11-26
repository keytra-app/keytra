"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ArrowUpRightIcon, GlobeIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { FieldLabel, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { COMMON_LOCALES } from "@/lib/i18n/locales";
import { addLocaleAction, removeLocaleAction } from "@/lib/projects/actions";
import type { LocaleProgress } from "@/lib/projects/queries";

const CUSTOM_CODE_VALUE = "__custom__";

function formatPct(pct: number): string {
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

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
  const [pendingAdd, startAddTransition] = useTransition();
  const [pendingRemove, startRemoveTransition] = useTransition();

  const existingCodes = new Set([sourceLocale.toLowerCase(), ...locales.map((l) => l.code.toLowerCase())]);
  const availablePresets = COMMON_LOCALES.filter((l) => !existingCodes.has(l.code.toLowerCase()));

  const [selectedCode, setSelectedCode] = useState<string>(
    availablePresets[0]?.code ?? CUSTOM_CODE_VALUE,
  );
  const [customCode, setCustomCode] = useState("");
  const [customName, setCustomName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [localeToRemove, setLocaleToRemove] = useState<LocaleProgress | null>(null);

  function openAddModal() {
    setSelectedCode(availablePresets[0]?.code ?? CUSTOM_CODE_VALUE);
    setCustomCode("");
    setCustomName("");
    setAddError(null);
    setAddOpen(true);
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    const isCustom = selectedCode === CUSTOM_CODE_VALUE;
    const code = isCustom ? customCode.trim() : selectedCode;
    const name = isCustom ? customName.trim() : undefined;

    startAddTransition(async () => {
      const result = await addLocaleAction({ projectId, code, name });
      if (!result.ok) {
        setAddError(result.error);
        return;
      }
      toast(`Sprache „${result.code}“ hinzugefügt.`);
      setAddOpen(false);
      router.refresh();
    });
  }

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
              : `${locales.length} ${locales.length === 1 ? "Sprache" : "Sprachen"} · ${totalKeys} ${totalKeys === 1 ? "Key" : "Keys"} in Ausgangssprache ${sourceLocale}`}
          </p>
        </div>

        {isAdmin && (
          <Button variant="primary" size="sm" onClick={openAddModal}>
            <PlusIcon className="h-3.5 w-3.5" />
            <span>Sprache hinzufügen</span>
          </Button>
        )}
      </div>

      {locales.length === 0 ? (
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
              {locales.map((locale) => {
                const translatedWidth =
                  locale.total > 0 ? Math.min(100, (locale.translated / locale.total) * 100) : 0;
                const outdatedWidth =
                  locale.total > 0
                    ? Math.min(100 - translatedWidth, (locale.outdated / locale.total) * 100)
                    : 0;

                return (
                  <tr key={locale.id} className="transition-colors hover:bg-zinc-900/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex rounded border border-zinc-800 bg-[#09090b] px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
                          {locale.code}
                        </span>
                        <span className="text-zinc-300">{locale.name}</span>
                      </div>
                    </td>

                    <td className="w-44 px-4 py-3">
                      <div className="flex h-1.5 w-full min-w-24 overflow-hidden rounded-full bg-zinc-800">
                        {translatedWidth > 0 && (
                          <div
                            className="h-full bg-emerald-500/85"
                            style={{ width: `${translatedWidth}%` }}
                          />
                        )}
                        {outdatedWidth > 0 && (
                          <div
                            className="h-full bg-amber-500/80"
                            style={{ width: `${outdatedWidth}%` }}
                          />
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-400/90">
                      {locale.translated}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-amber-400/90">
                      {locale.outdated}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-400">
                      {locale.missing}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-100">
                      {formatPct(locale.percentage)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/projects/${projectSlug}/translate/${encodeURIComponent(locale.code)}`}
                          className={buttonClasses({ variant: "secondary", size: "xs" })}
                        >
                          <span>Editor</span>
                          <ArrowUpRightIcon className="h-3 w-3" />
                        </Link>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="xs"
                            aria-label={`Sprache ${locale.code} entfernen`}
                            title="Sprache entfernen"
                            onClick={() => setLocaleToRemove(locale)}
                            className="px-1.5 text-zinc-500 hover:text-red-400"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => !pendingAdd && setAddOpen(false)}
        title="Sprache hinzufügen"
        description="Wähle einen ISO-Sprachcode oder gib einen eigenen BCP-47-Code ein."
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="add-locale-select">Sprache</FieldLabel>
            <Select
              id="add-locale-select"
              mono
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
            >
              {availablePresets.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.code} — {loc.name}
                </option>
              ))}
              <option value={CUSTOM_CODE_VALUE}>Eigener Code …</option>
            </Select>
          </div>

          {selectedCode === CUSTOM_CODE_VALUE && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="custom-locale-code">ISO / BCP-47 Code</FieldLabel>
                <Input
                  id="custom-locale-code"
                  mono
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="z. B. sv, de-AT"
                  maxLength={20}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="custom-locale-name" hint="Optional">
                  Anzeigename
                </FieldLabel>
                <Input
                  id="custom-locale-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="z. B. Schwedisch"
                  maxLength={64}
                />
              </div>
            </div>
          )}

          {addError && (
            <p role="alert" className="rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {addError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-4">
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={pendingAdd}>
              Abbrechen
            </Button>
            <Button type="submit" variant="primary" disabled={pendingAdd}>
              {pendingAdd ? "Speichere …" : "Hinzufügen"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(localeToRemove)}
        onClose={() => !pendingRemove && setLocaleToRemove(null)}
        title="Sprache entfernen"
        description={
          localeToRemove
            ? `Alle gespeicherten Übersetzungen für ${localeToRemove.name} (${localeToRemove.code}) werden unwiderruflich gelöscht.`
            : undefined
        }
      >
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-4">
          <Button variant="ghost" onClick={() => setLocaleToRemove(null)} disabled={pendingRemove}>
            Abbrechen
          </Button>
          <Button variant="danger-solid" onClick={handleConfirmRemove} disabled={pendingRemove}>
            {pendingRemove ? "Entferne …" : "Unwiderruflich entfernen"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
