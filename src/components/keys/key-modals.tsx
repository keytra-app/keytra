"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon } from "@/components/ui/icons";
import { FieldLabel, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { deleteKeyAction, updateKeyAction } from "@/lib/editor/actions";
import type { SourceKey } from "@/lib/editor/queries";

export function EditKeyModal({
  item,
  onClose,
  projectId,
  sourceLocale,
  onUpdated,
}: {
  item: SourceKey | null;
  onClose: () => void;
  projectId: string;
  sourceLocale: string;
  onUpdated: (payload: {
    keyId: string;
    sourceValue: string;
    description: string | null;
    sourceChanged: boolean;
  }) => void;
}) {
  const { toast } = useToast();
  const [sourceValue, setSourceValue] = useState(item?.sourceValue ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!item) return null;

  const sourceWillChange = sourceValue !== item.sourceValue;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setError(null);

    startTransition(async () => {
      const result = await updateKeyAction({
        projectId,
        keyId: item.id,
        sourceValue,
        description,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onUpdated({
        keyId: item.id,
        sourceValue: result.sourceValue,
        description: result.description,
        sourceChanged: result.sourceChanged,
      });
      toast(
        result.sourceChanged
          ? "Key aktualisiert — bestehende Übersetzungen wurden als veraltet markiert."
          : "Key aktualisiert.",
      );
      onClose();
    });
  }

  return (
    <Modal
      open={Boolean(item)}
      onClose={() => !pending && onClose()}
      title="Key bearbeiten"
      description={`${item.namespace} · ${item.key}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="edit-key-source" hint={`Ausgangssprache (${sourceLocale})`}>
            Quelltext
          </FieldLabel>
          <Textarea
            id="edit-key-source"
            rows={4}
            value={sourceValue}
            onChange={(e) => setSourceValue(e.target.value)}
            required
            autoFocus
          />
        </div>

        {sourceWillChange && (
          <div className="flex items-start gap-2 rounded-md border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
            <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>
              Eine Änderung des Quelltextes markiert bestehende Übersetzungen dieses Keys in allen
              Sprachen automatisch als <strong className="font-medium">veraltet</strong>.
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <FieldLabel htmlFor="edit-key-desc" hint="Optional">
            Kontext / Beschreibung
          </FieldLabel>
          <Textarea
            id="edit-key-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hinweis für Übersetzer …"
            maxLength={1000}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-xs text-red-300"
          >
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Speichere …" : "Änderungen speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteKeyModal({
  item,
  onClose,
  projectId,
  onDeleted,
}: {
  item: SourceKey | null;
  onClose: () => void;
  projectId: string;
  onDeleted: (keyId: string) => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    if (!item) return;
    const target = item;

    startTransition(async () => {
      const result = await deleteKeyAction({ projectId, keyId: target.id });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      onDeleted(target.id);
      toast(`Key „${target.key}“ gelöscht.`);
      onClose();
    });
  }

  return (
    <Modal
      open={Boolean(item)}
      onClose={() => !pending && onClose()}
      title="Key löschen"
      description={
        item
          ? `Der Key „${item.key}“ (${item.namespace}) und alle zugehörigen Übersetzungen in allen Sprachen werden unwiderruflich gelöscht.`
          : undefined
      }
    >
      <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-4">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Abbrechen
        </Button>
        <Button variant="danger-solid" onClick={handleConfirm} disabled={pending}>
          {pending ? "Lösche …" : "Unwiderruflich löschen"}
        </Button>
      </div>
    </Modal>
  );
}
