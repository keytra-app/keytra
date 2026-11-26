import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import type { KeyFilter } from "./key-status";

const FILTER_DONE_TITLE: Partial<Record<KeyFilter, string>> = {
  untranslated: "Alle Keys sind übersetzt",
  outdated: "Keine veralteten Keys",
};

/** Shown in the editor pane when no key is selected. */
export function EditorEmptyState({
  hasKeys,
  isAdmin,
  filter,
  isFiltered,
  onCreateKey,
  onResetFilters,
}: {
  hasKeys: boolean;
  isAdmin: boolean;
  filter: KeyFilter;
  isFiltered: boolean;
  onCreateKey: () => void;
  onResetFilters: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      {hasKeys ? (
        <>
          <p className="text-sm font-medium text-zinc-200">
            {FILTER_DONE_TITLE[filter] ?? "Kein Key ausgewählt"}
          </p>
          <p className="max-w-xs text-xs text-zinc-500">
            {isFiltered
              ? "Wechsle den Filter oder leere die Suche, um weitere Keys anzuzeigen."
              : "Wähle links einen Key aus der Liste aus."}
          </p>
          {isFiltered && (
            <Button variant="secondary" size="xs" onClick={onResetFilters}>
              Filter zurücksetzen
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-zinc-200">Noch keine Keys im Projekt</p>
          <p className="max-w-sm text-xs text-zinc-500">
            {isAdmin
              ? "Lege deinen ersten Key direkt hier an oder pushe deine Source-Datei über die API."
              : "Ein Administrator hat noch keine Übersetzungs-Keys angelegt."}
          </p>
          {isAdmin && (
            <Button variant="primary" size="sm" className="mt-1" onClick={onCreateKey}>
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Ersten Key hinzufügen</span>
            </Button>
          )}
        </>
      )}
    </div>
  );
}
