"use client";

import { useState } from "react";
import { useCopyToClipboard } from "@/components/ui/copy-button";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, CopyIcon } from "@/components/ui/icons";
import type { EditorReferenceTranslation } from "@/lib/editor/queries";

/** Collapsible list of finished translations of the key in the other target languages. */
export function ReferenceLanguages({ references }: { references: EditorReferenceTranslation[] }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDownIcon : ChevronRightIcon;

  return (
    <section className="border-t border-zinc-800/80 pt-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md py-1 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Chevron className="h-3.5 w-3.5 text-zinc-500" />
          <span>Referenz-Sprachen</span>
          <span className="rounded border border-zinc-800 bg-[#111113] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 tabular-nums">
            {references.length}
          </span>
        </span>
        <span className="text-[11px] text-zinc-600">
          {open ? "Ausblenden" : "Andere Sprachen anzeigen"}
        </span>
      </button>

      {open && (
        <div className="mt-2.5 space-y-1.5">
          {references.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-800/80 px-3 py-2.5 text-xs text-zinc-600">
              Noch keine fertigen Übersetzungen dieses Keys in anderen Zielsprachen vorhanden.
            </p>
          ) : (
            references.map((ref) => <ReferenceRow key={ref.localeCode} reference={ref} />)
          )}
        </div>
      )}
    </section>
  );
}

function ReferenceRow({ reference }: { reference: EditorReferenceTranslation }) {
  const { copied, copy } = useCopyToClipboard(1600);
  const { localeCode, localeName, value } = reference;

  return (
    <button
      type="button"
      onClick={() => copy(value, `Referenz (${localeCode}) kopiert.`)}
      title="Klicken zum Kopieren"
      className="group flex w-full cursor-pointer items-start justify-between gap-3 rounded-md border border-zinc-800/80 bg-[#09090b] px-3 py-2 text-left transition-colors hover:border-zinc-700 hover:bg-[#111113]"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-zinc-300">{localeCode}</span>
          <span className="text-[11px] text-zinc-500">{localeName}</span>
        </div>
        <p className="text-xs leading-relaxed break-words whitespace-pre-wrap text-zinc-300">
          {value}
        </p>
      </div>
      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11px] text-zinc-500 transition-colors group-hover:text-zinc-200">
        {copied ? (
          <>
            <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-400">Kopiert</span>
          </>
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
      </span>
    </button>
  );
}
