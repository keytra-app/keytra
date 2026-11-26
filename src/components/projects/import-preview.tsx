import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ModalActions } from "@/components/ui/modal";
import type { ImportSummary } from "@/lib/projects/import-actions";

export type ImportMode = "source" | "target";

const MAX_LISTED_KEYS = 500;

type ChangeGroup = { label: string; count: number; keys: string[] };

function changeGroups(preview: ImportSummary, mode: ImportMode, prune: boolean): ChangeGroup[] {
  const isSource = mode === "source";
  const groups: ChangeGroup[] = [
    {
      label: isSource ? "neue Keys" : "neue Übersetzungen",
      count: preview.added,
      keys: preview.keys.added,
    },
    {
      label: isSource
        ? "geänderte Keys (Übersetzungen werden als veraltet markiert)"
        : "geänderte Übersetzungen",
      count: preview.updated,
      keys: preview.keys.updated,
    },
    { label: "unverändert", count: preview.unchanged, keys: [] },
  ];
  if (!isSource) {
    groups.push({
      label: "übersprungen (unbekannter Key oder leerer Wert)",
      count: preview.skipped,
      keys: preview.keys.skipped,
    });
  }
  if (prune) {
    groups.push({
      label: "Keys werden gelöscht",
      count: preview.pruned,
      keys: preview.keys.pruned,
    });
  }
  return groups;
}

/** Dry-run result of an import, with the prune opt-in for source imports. */
export function ImportPreview({
  preview,
  mode,
  localeCode,
  namespace,
  prune,
  onPruneChange,
  pending,
  error,
  onBack,
  onConfirm,
}: {
  preview: ImportSummary;
  mode: ImportMode;
  localeCode: string | undefined;
  namespace: string;
  prune: boolean;
  onPruneChange: (prune: boolean) => void;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const changes = preview.added + preview.updated + (prune ? preview.pruned : 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Vorschau für <span className="font-mono text-zinc-300">{localeCode}</span> · Namespace{" "}
        <span className="font-mono break-all text-zinc-300">{namespace}</span>
      </p>

      <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
        {changeGroups(preview, mode, prune).map((group) => (
          <li key={group.label} className="px-3 py-2 text-xs text-zinc-300">
            {group.keys.length > 0 ? (
              <details>
                <summary className="cursor-pointer">
                  <GroupLabel group={group} />
                </summary>
                <KeyList keys={group.keys} />
              </details>
            ) : (
              <div className="pl-3.5">
                <GroupLabel group={group} />
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
            onChange={(e) => onPruneChange(e.target.checked)}
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

      <FormError>{error}</FormError>

      <ModalActions>
        <Button variant="ghost" onClick={onBack} disabled={pending}>
          Zurück
        </Button>
        <Button
          variant={prune ? "danger-solid" : "primary"}
          onClick={onConfirm}
          disabled={pending || changes === 0}
        >
          {pending ? "Importiere …" : changes === 0 ? "Keine Änderungen" : "Importieren"}
        </Button>
      </ModalActions>
    </div>
  );
}

function GroupLabel({ group }: { group: ChangeGroup }) {
  return (
    <>
      <span className="font-mono text-zinc-100">{group.count}</span> {group.label}
    </>
  );
}

// shortcut: renders at most 500 names; virtualize if users need to scan more.
function KeyList({ keys }: { keys: string[] }) {
  return (
    <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-zinc-800 bg-[#09090b] px-2 py-1.5 font-mono text-[11px] break-all text-zinc-400">
      {keys.slice(0, MAX_LISTED_KEYS).map((key) => (
        <li key={key}>{key}</li>
      ))}
      {keys.length > MAX_LISTED_KEYS && (
        <li className="text-zinc-600">… {keys.length - MAX_LISTED_KEYS} weitere</li>
      )}
    </ul>
  );
}
