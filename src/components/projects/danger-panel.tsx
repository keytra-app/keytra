"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon, TrashIcon } from "@/components/ui/icons";
import { FieldLabel, Input } from "@/components/ui/input";
import { Modal, ModalActions } from "@/components/ui/modal";
import { deleteProjectAction } from "@/lib/projects/actions";

export function DangerPanel({
  projectId,
  projectName,
  projectSlug,
}: {
  projectId: string;
  projectName: string;
  projectSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = confirmSlug.trim() === projectSlug;

  function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    setError(null);

    startTransition(async () => {
      const result = await deleteProjectAction({ projectId, confirmSlug });
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium text-zinc-100">Gefahrenzone</h2>
        <p className="text-xs text-zinc-500">
          Destruktive Aktionen wirken sich sofort auf alle Daten und CI-Integrationen dieses
          Projekts aus.
        </p>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-lg border border-red-950/90 bg-[#111113] p-5 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <AlertTriangleIcon className="h-4 w-4 text-red-400" />
            <span>Projekt löschen</span>
          </div>
          <p className="max-w-lg text-xs text-zinc-400">
            Löscht <span className="font-medium text-zinc-200">{projectName}</span> samt aller
            Translation-Keys, Übersetzungen, Zielsprachen und API-Keys dauerhaft.
          </p>
        </div>

        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            setConfirmSlug("");
            setError(null);
            setOpen(true);
          }}
          className="shrink-0"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          <span>Projekt löschen</span>
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Projekt endgültig löschen"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
      >
        <form onSubmit={handleDelete} className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="confirm-project-slug">
              Tippe <span className="font-mono text-zinc-200">{projectSlug}</span> zur Bestätigung
              ein
            </FieldLabel>
            <Input
              id="confirm-project-slug"
              mono
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={projectSlug}
              autoFocus
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-400">
              {error}
            </p>
          )}

          <ModalActions>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="submit" variant="danger-solid" disabled={!matches || pending}>
              {pending ? "Lösche …" : "Endgültig löschen"}
            </Button>
          </ModalActions>
        </form>
      </Modal>
    </section>
  );
}
