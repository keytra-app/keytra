"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { UploadIcon } from "@/components/ui/icons";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  confirmImportAction,
  previewImportAction,
  type ImportInput,
  type ImportSummary,
} from "@/lib/projects/import-actions";
import type { LocaleProgress } from "@/lib/projects/queries";

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
  const options = [...new Set(["default", ...namespaces])];

  const [mode, setMode] = useState<"source" | "target">("source");
  const [localeId, setLocaleId] = useState(locales[0]?.id ?? "");
  const [selectedNamespace, setSelectedNamespace] = useState("default");
  const [newNamespace, setNewNamespace] = useState("");
  const [json, setJson] = useState("");
  const [dragging, setDragging] = useState(false);
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

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.name.toLowerCase().endsWith(".json")) return setError("Bitte eine .json-Datei wählen.");
    if (file.size > MAX_BYTES) return setError("Die Datei ist größer als 5 MB.");
    try {
      setJson(await file.text());
    } catch {
      setError("Die Datei konnte nicht gelesen werden.");
    }
  }

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (new Blob([json]).size > MAX_BYTES) return setError("Das JSON ist größer als 5 MB.");
    try {
      JSON.parse(json.trim());
    } catch (err) {
      return setError(`Ungültiges JSON: ${(err as Error).message}`);
    }
    startTransition(async () => {
      try {
        const result = await previewImportAction(input);
        if (!result.ok) return setError(result.error);
        setPrune(false);
        setPreview(result.summary);
      } catch {
        setError(REQUEST_FAILED);
      }
    });
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await confirmImportAction(input);
        if (!result.ok) return setError(result.error);
        const s = result.summary;
        const extra = mode === "source" ? `${s.pruned} gelöscht` : `${s.skipped} übersprungen`;
        toast(`Import: ${s.added} neu · ${s.updated} geändert · ${extra}`);
        onDone();
        router.refresh();
      } catch {
        setError(REQUEST_FAILED);
      }
    });
  }

  const alert = error && (
    <p role="alert" className="rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-xs break-words text-red-300">
      {error}
    </p>
  );

  if (preview) {
    const pruneCount = prune ? preview.pruned : 0;
    const changes = preview.added + preview.updated + pruneCount;
    const groups = [
      {
        label: mode === "source" ? "neue Keys" : "neue Übersetzungen",
        count: preview.added,
        keys: preview.keys.added,
      },
      {
        label:
          mode === "source"
            ? "geänderte Keys (Übersetzungen werden als veraltet markiert)"
            : "geänderte Übersetzungen",
        count: preview.updated,
        keys: preview.keys.updated,
      },
      { label: "unverändert", count: preview.unchanged, keys: [] },
      ...(mode === "target"
        ? [{ label: "übersprungen (unbekannter Key oder leerer Wert)", count: preview.skipped, keys: preview.keys.skipped }]
        : []),
      ...(prune ? [{ label: "Keys werden gelöscht", count: preview.pruned, keys: preview.keys.pruned }] : []),
    ];

    return (
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">
          Vorschau für{" "}
          <span className="font-mono text-zinc-300">
            {mode === "source" ? sourceLocale : locales.find((l) => l.id === localeId)?.code}
          </span>{" "}
          · Namespace <span className="font-mono break-all text-zinc-300">{namespace}</span>
        </p>

        <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
          {groups.map((group) => (
            <li key={group.label} className="px-3 py-2 text-xs text-zinc-300">
              {group.keys.length > 0 ? (
                <details>
                  <summary className="cursor-pointer">
                    <span className="font-mono text-zinc-100">{group.count}</span> {group.label}
                  </summary>
                  <KeyList keys={group.keys} />
                </details>
              ) : (
                <div className="pl-3.5">
                  <span className="font-mono text-zinc-100">{group.count}</span> {group.label}
                </div>
              )}
            </li>
          ))}
        </ul>

        {mode === "source" && (
          <label className="flex items-start gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={prune}
              onChange={(e) => setPrune(e.target.checked)}
              disabled={pending || preview.pruned === 0}
              className="mt-0.5 accent-zinc-100"
            />
            <span>
              Verwaiste Keys in diesem Namespace entfernen (Prune):{" "}
              <span className="font-mono">{preview.pruned}</span>
              {prune && (
                <span className="block text-red-400">
                  {preview.pruned} Keys samt Übersetzungen werden unwiderruflich gelöscht.
                </span>
              )}
            </span>
          </label>
        )}

        {alert}

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-4">
          <Button
            variant="ghost"
            onClick={() => {
              setError(null);
              setPreview(null);
            }}
            disabled={pending}
          >
            Zurück
          </Button>
          <Button
            variant={prune ? "danger-solid" : "primary"}
            onClick={handleConfirm}
            disabled={pending || changes === 0}
          >
            {pending ? "Importiere …" : changes === 0 ? "Keine Änderungen" : "Importieren"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePreview} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="import-mode">Modus</FieldLabel>
          <Select id="import-mode" value={mode} onChange={(e) => setMode(e.target.value as "source" | "target")}>
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
            <Select id="import-locale" mono value={localeId} onChange={(e) => setLocaleId(e.target.value)}>
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
          {options.map((ns) => (
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
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder={'{\n  "auth": { "login": "Anmelden" }\n}'}
          spellCheck={false}
          className="font-mono !text-xs"
          required
        />
      </div>

      {alert}

      <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-4">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !json.trim()}>
          {pending ? "Prüfe …" : "Vorschau"}
        </Button>
      </div>
    </form>
  );
}

// shortcut: renders at most 500 names; virtualize if users need to scan more.
function KeyList({ keys }: { keys: string[] }) {
  return (
    <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-zinc-800 bg-[#09090b] px-2 py-1.5 font-mono text-[11px] break-all text-zinc-400">
      {keys.slice(0, 500).map((key) => (
        <li key={key}>{key}</li>
      ))}
      {keys.length > 500 && <li className="text-zinc-600">… {keys.length - 500} weitere</li>}
    </ul>
  );
}
