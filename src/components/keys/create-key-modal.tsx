"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createKeyAction } from "@/lib/editor/actions";
import type { SourceKey } from "@/lib/editor/queries";

export type KeyProject = {
  id: string;
  name: string;
  sourceLocale: string;
  namespaces: string[];
};

// Real namespaces are never empty, so "" is free to mean "new namespace".
const NEW_NAMESPACE = "";

type CreateKeyModalProps = {
  onClose: () => void;
  /** Without `selectableProject`, the first entry is the fixed project. */
  projects: KeyProject[];
  selectableProject?: boolean;
  defaultNamespace?: string;
  onCreated?: (item: SourceKey, keepOpen: boolean) => void;
};

/** Mount only while open: the form state starts fresh on every mount. */
export function CreateKeyModal({
  onClose,
  projects,
  selectableProject = false,
  defaultNamespace = "default",
  onCreated,
}: CreateKeyModalProps) {
  const { toast } = useToast();
  const keyRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [namespace, setNamespace] = useState(defaultNamespace);
  const [newNamespace, setNewNamespace] = useState("");
  const [keyName, setKeyName] = useState("");
  const [sourceValue, setSourceValue] = useState("");
  const [description, setDescription] = useState("");
  const [keepOpen, setKeepOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;

  const isNewNamespace = namespace === NEW_NAMESPACE;
  // The current selection stays listed even before the refreshed project data contains it.
  const namespaceOptions = [
    ...new Set(["default", ...project.namespaces, ...(isNewNamespace ? [] : [namespace])]),
  ].sort((a, b) => a.localeCompare(b));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createKeyAction({
        projectId,
        namespace: isNewNamespace ? newNamespace : namespace,
        key: keyName,
        sourceValue,
        description,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onCreated?.(result.item, keepOpen);
      toast(`Key „${result.item.key}“ angelegt.`);

      if (!keepOpen) {
        onClose();
        return;
      }
      setNamespace(result.item.namespace);
      setNewNamespace("");
      setKeyName("");
      setSourceValue("");
      setDescription("");
      keyRef.current?.focus();
    });
  }

  return (
    <Modal
      open
      onClose={() => !pending && onClose()}
      title="Key hinzufügen"
      description="Neuen Übersetzungs-Key direkt im Projekt anlegen."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {selectableProject && (
          <div className="space-y-1.5">
            <FieldLabel htmlFor="create-key-project">Projekt</FieldLabel>
            <Select
              id="create-key-project"
              value={projectId}
              disabled={pending}
              onChange={(e) => {
                setProjectId(e.target.value);
                setNamespace("default");
                setNewNamespace("");
                setError(null);
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <FieldLabel htmlFor="create-key-ns">Namespace</FieldLabel>
          <Select
            id="create-key-ns"
            mono
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
          >
            {namespaceOptions.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
            <option value={NEW_NAMESPACE}>Neuer Namespace …</option>
          </Select>
          {isNewNamespace && (
            <Input
              mono
              aria-label="Name des neuen Namespace"
              value={newNamespace}
              onChange={(e) => setNewNamespace(e.target.value)}
              placeholder="z. B. checkout"
              maxLength={100}
              required
              autoFocus
            />
          )}
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="create-key-path">Key</FieldLabel>
          <Input
            id="create-key-path"
            ref={keyRef}
            mono
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="z. B. auth.login.button"
            maxLength={512}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="create-key-source" hint={`Ausgangssprache (${project.sourceLocale})`}>
            Quelltext
          </FieldLabel>
          <Textarea
            id="create-key-source"
            rows={3}
            value={sourceValue}
            onChange={(e) => setSourceValue(e.target.value)}
            placeholder="Text in der Ausgangssprache …"
            required
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="create-key-desc" hint="Optional">
            Kontext / Beschreibung
          </FieldLabel>
          <Textarea
            id="create-key-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hinweis für Übersetzer, z. B. Wo erscheint der Text?"
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={keepOpen}
              onChange={(e) => setKeepOpen(e.target.checked)}
              className="accent-zinc-200"
            />
            Danach weiteren Key anlegen
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Speichere …" : "Key anlegen"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function CreateKeyButton(
  props: Pick<CreateKeyModalProps, "projects" | "selectableProject" | "defaultNamespace">,
) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={props.projects.length === 0}
      >
        <PlusIcon className="h-3.5 w-3.5" />
        <span>Key erstellen</span>
      </Button>
      {open && <CreateKeyModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
