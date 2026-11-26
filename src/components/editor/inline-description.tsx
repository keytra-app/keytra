"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { EditIcon } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateKeyAction } from "@/lib/editor/actions";
import type { EditorKeyItem } from "@/lib/editor/queries";

/** Translator context of a key. Admins edit it in place; translators only see it. */
export function InlineDescription({
  projectId,
  item,
  isAdmin,
  onDescriptionSaved,
  onEditingChange,
}: {
  projectId: string;
  item: EditorKeyItem;
  isAdmin: boolean;
  onDescriptionSaved: (keyId: string, description: string | null) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.description ?? "");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function startEditing() {
    setDraft(item.description ?? "");
    setEditing(true);
    onEditingChange(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function cancelEditing() {
    setEditing(false);
    onEditingChange(false);
  }

  function saveDescription() {
    const nextDesc = draft.trim() || null;
    if (nextDesc === (item.description ?? null)) {
      cancelEditing();
      return;
    }

    startTransition(async () => {
      const res = await updateKeyAction({
        projectId,
        keyId: item.id,
        description: nextDesc,
      });
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      onDescriptionSaved(item.id, res.description);
      toast("Kontext gespeichert.");
      cancelEditing();
    });
  }

  if (!isAdmin && !item.description) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-md border border-zinc-800/80 bg-[#111113]/70 px-3.5 py-2.5">
        <p className="text-[11px] font-medium text-zinc-500">Kontext</p>
        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
          {item.description}
        </p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-md border border-zinc-700 bg-[#111113] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-400">Kontext / Beschreibung</span>
          <span className="text-[10px] text-zinc-600">Esc zum Abbrechen · ⌘↵ Speichern</span>
        </div>
        <Textarea
          ref={inputRef}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              cancelEditing();
            } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              saveDescription();
            }
          }}
          placeholder="Hinweis für Übersetzer hinzufügen …"
          maxLength={1000}
          className="text-xs"
        />
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="ghost" size="xs" onClick={cancelEditing} disabled={pending}>
            Abbrechen
          </Button>
          <Button variant="primary" size="xs" onClick={saveDescription} disabled={pending}>
            {pending ? "Speichere …" : "Speichern"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="group flex w-full items-start justify-between gap-3 rounded-md border border-zinc-800/80 bg-[#111113]/60 px-3.5 py-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-[#111113] cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-zinc-500">Kontext</p>
        {item.description ? (
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
            {item.description}
          </p>
        ) : (
          <p className="mt-1 text-xs text-zinc-600 group-hover:text-zinc-500">
            Kontext oder Hinweis für Übersetzer hinzufügen …
          </p>
        )}
      </div>
      <EditIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300" />
    </button>
  );
}
