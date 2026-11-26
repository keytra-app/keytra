"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { UploadIcon } from "@/components/ui/icons";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, ModalActions } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  confirmImportAction,
  type ImportInput,
  type ImportSummary,
  previewImportAction,
} from "@/lib/projects/import-actions";
import type { LocaleProgress } from "@/lib/projects/progress";
import { type ImportMode, ImportPreview } from "./import-preview";

// Must stay below `serverActions.bodySizeLimit` in next.config.ts.
const MAX_BYTES = 5 * 1024 * 1024;
const NEW_NAMESPACE = "__new__";
const REQUEST_FAILED = "Anfrage fehlgeschlagen. Bitte erneut versuchen.";

type Props = {
  projectId: string;
  sourceLocale: string;
  locales: LocaleProgress[];
  namespaces: string[];
};

export function ImportModalButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // A running import must not be hidden by Escape or a backdrop click.
  const close = () => {
    if (!pending) setOpen(false);
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <UploadIcon className="h-3.5 w-3.5" />
        <span>Import JSON</span>
      </Button>
      <Modal open={open} onClose={close} title="JSON importieren" maxWidth="max-w-lg">
        <ImportForm
          {...props}
          pending={pending}
          startTransition={startTransition}
          onCancel={close}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function jsonSyntaxError(json: string): string | null {
  try {
    JSON.parse(json.trim());
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function ImportForm({
  projectId,
  sourceLocale,
  locales,
  namespaces,
  pending,
  startTransition,
  onCancel,
  onDone,
}: Props & {
  pending: boolean;
  startTransition: (action: () => Promise<void>) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [mode, setMode] = useState<ImportMode>("source");
  const [localeId, setLocaleId] = useState(locales[0]?.id ?? "");
  const [selectedNamespace, setSelectedNamespace] = useState("default");
  const [newNamespace, setNewNamespace] = useState("");
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [prune, setPrune] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const namespace = selectedNamespace === NEW_NAMESPACE ? newNamespace.trim() : selectedNamespace;
  const input: ImportInput = {
    projectId,
    localeId: mode === "source" ? null : localeId,
    namespace,
    json,
    prune: mode === "source" && prune,
  };

  /** Runs a server request; network failures surface as a generic error. */
  function request(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError(REQUEST_FAILED);
      }
    });
  }

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (new Blob([json]).size > MAX_BYTES) return setError("Das JSON ist größer als 5 MB.");
    const syntaxError = jsonSyntaxError(json);
    if (syntaxError) return setError(`Ungültiges JSON: ${syntaxError}`);

    request(async () => {
      const result = await previewImportAction(input);
      if (!result.ok) return setError(result.error);
      setPrune(false);
      setPreview(result.summary);
    });
  }

  function handleConfirm() {
    request(async () => {
      const result = await confirmImportAction(input);
      if (!result.ok) return setError(result.error);
      const { added, updated, pruned, skipped } = result.summary;
      const extra = mode === "source" ? `${pruned} gelöscht` : `${skipped} übersprungen`;
      toast(`Import: ${added} neu · ${updated} geändert · ${extra}`);
      onDone();
      router.refresh();
    });
  }

  if (preview) {
    return (
      <ImportPreview
        preview={preview}
        mode={mode}
        localeCode={mode === "source" ? sourceLocale : locales.find((l) => l.id === localeId)?.code}
        namespace={namespace}
        prune={prune}
        onPruneChange={setPrune}
        pending={pending}
        error={error}
        onBack={() => {
          setError(null);
          setPreview(null);
        }}
        onConfirm={handleConfirm}
      />
    );
  }

  return (
    <form onSubmit={handlePreview} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="import-mode">Modus</FieldLabel>
          <Select
            id="import-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value === "target" ? "target" : "source")}
          >
            <option value="source">Quellsprache importieren</option>
            <option value="target" disabled={locales.length === 0}>
              Zielsprache importieren
            </option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="import-locale">Sprache</FieldLabel>
          {mode === "source" ? (
            <Input id="import-locale" mono value={sourceLocale} disabled readOnly />
          ) : (
            <Select
              id="import-locale"
              mono
              value={localeId}
              onChange={(e) => setLocaleId(e.target.value)}
            >
              {locales.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="import-namespace">Namespace</FieldLabel>
        <Select
          id="import-namespace"
          mono
          value={selectedNamespace}
          onChange={(e) => setSelectedNamespace(e.target.value)}
        >
          {[...new Set(["default", ...namespaces])].map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
          <option value={NEW_NAMESPACE}>Neuer Namespace …</option>
        </Select>
        {selectedNamespace === NEW_NAMESPACE && (
          <Input
            mono
            aria-label="Name des neuen Namespace"
            value={newNamespace}
            onChange={(e) => setNewNamespace(e.target.value)}
            placeholder="z. B. common"
            maxLength={100}
            required
            autoFocus
          />
        )}
      </div>

      <JsonField value={json} onChange={setJson} onError={setError} />

      <FormError>{error}</FormError>

      <ModalActions>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !json.trim()}>
          {pending ? "Prüfe …" : "Vorschau"}
        </Button>
      </ModalActions>
    </form>
  );
}

/** JSON textarea that also accepts a dropped or picked .json file. */
function JsonField({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (json: string) => void;
  onError: (error: string | null) => void;
}) {
  const [dragging, setDragging] = useState(false);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    onError(null);
    if (!file.name.toLowerCase().endsWith(".json"))
      return onError("Bitte eine .json-Datei wählen.");
    if (file.size > MAX_BYTES) return onError("Die Datei ist größer als 5 MB.");
    try {
      onChange(await file.text());
    } catch {
      onError("Die Datei konnte nicht gelesen werden.");
    }
  }

  return (
    <div
      className="space-y-1.5"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void loadFile(e.dataTransfer.files[0]);
      }}
    >
      <FieldLabel htmlFor="import-json" hint="Max. 5 MB">
        JSON
      </FieldLabel>
      <label
        className={`flex cursor-pointer justify-center rounded-md border border-dashed px-3 py-4 text-xs text-zinc-400 transition-colors focus-within:border-zinc-400 hover:border-zinc-600 ${
          dragging ? "border-zinc-400 bg-zinc-900" : "border-zinc-800"
        }`}
      >
        <span>.json-Datei hierher ziehen oder auswählen</span>
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => {
            void loadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <Textarea
        id="import-json"
        rows={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'{\n  "auth": { "login": "Anmelden" }\n}'}
        spellCheck={false}
        className="font-mono !text-xs"
        required
      />
    </div>
  );
}
