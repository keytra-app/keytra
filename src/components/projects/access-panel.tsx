"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { TranslatorAccess } from "@/lib/auth/session";
import { updateProjectAccessAction } from "@/lib/projects/actions";
import type { TranslatorOption } from "@/lib/projects/queries";

export function AccessPanel({
  projectId,
  initialAccess,
  translators,
  initialMemberIds,
}: {
  projectId: string;
  initialAccess: TranslatorAccess;
  translators: TranslatorOption[];
  initialMemberIds: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState(initialAccess);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialMemberIds);
  const [pending, startTransition] = useTransition();

  const selectedSet = new Set(selectedIds);
  const initialSet = new Set(initialMemberIds);
  const isDirty =
    mode !== initialAccess ||
    selectedIds.length !== initialMemberIds.length ||
    selectedIds.some((id) => !initialSet.has(id));

  function toggleMember(userId: string) {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateProjectAccessAction({
        projectId,
        translatorAccess: mode,
        memberIds: selectedIds,
      });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Zugriffseinstellungen gespeichert.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-5">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium text-zinc-100">Translator-Zugriff</h2>
        <p className="text-xs text-zinc-500">
          Admins haben immer Zugriff auf alle Projekte. Lege fest, welche Translators dieses Projekt
          sehen und übersetzen dürfen.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AccessModeCard
          title="Alle Translators"
          active={mode === "all"}
          onSelect={() => setMode("all")}
        >
          Jeder Account mit Rolle <span className="font-mono text-zinc-400">translator</span> hat
          automatisch Zugriff.
        </AccessModeCard>
        <AccessModeCard
          title="Nur ausgewählte Translators"
          active={mode === "selected"}
          onSelect={() => setMode("selected")}
        >
          Nur die unten ausgewählten Translators sehen dieses Projekt.
        </AccessModeCard>
      </div>

      {mode === "selected" && (
        <div className="rounded-lg border border-zinc-800 bg-[#111113]">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <span className="text-xs font-medium text-zinc-300">
              Freigegebene Translators ({selectedIds.length}/{translators.length})
            </span>
            {translators.length > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedIds(translators.map((t) => t.id))}
                  className="text-zinc-400 hover:text-zinc-100 cursor-pointer"
                >
                  Alle
                </button>
                <span className="text-zinc-700">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-zinc-400 hover:text-zinc-100 cursor-pointer"
                >
                  Keine
                </button>
              </div>
            )}
          </div>

          {translators.length === 0 ? (
            <div className="px-4 py-6 text-xs text-zinc-500">
              Noch keine Translator-Accounts vorhanden.{" "}
              <Link
                href="/settings/users"
                className="text-zinc-300 underline underline-offset-4 hover:text-white"
              >
                Team verwalten
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800/70">
              {translators.map((translator) => {
                const checked = selectedSet.has(translator.id);
                return (
                  <li key={translator.id}>
                    <label className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-900/50 cursor-pointer">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(translator.id)}
                          className="h-3.5 w-3.5 rounded border-zinc-700 bg-[#09090b] accent-zinc-100 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-zinc-200">
                            {translator.name}
                          </p>
                          <p className="truncate font-mono text-[11px] text-zinc-500">
                            {translator.email}
                          </p>
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={pending || !isDirty}>
          {pending ? "Speichere …" : "Zugriff speichern"}
        </Button>
      </div>
    </section>
  );
}

function AccessModeCard({
  title,
  active,
  onSelect,
  children,
}: {
  title: string;
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 text-left transition-colors ${
        active
          ? "border-zinc-500 bg-[#111113]"
          : "border-zinc-800 bg-[#111113]/50 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-100">{title}</span>
        <span
          className={`h-3.5 w-3.5 rounded-full border ${
            active ? "border-zinc-100 bg-zinc-100" : "border-zinc-700"
          }`}
        />
      </div>
      <p className="text-xs text-zinc-500">{children}</p>
    </button>
  );
}
