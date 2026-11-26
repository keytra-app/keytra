import { AlertTriangleIcon, CheckIcon } from "@/components/ui/icons";

// Keeps the textarea focused, so the token lands at its cursor.
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

/** Clickable source placeholders; missing ones are highlighted. */
export function PlaceholderChips({
  placeholders,
  missing,
  onInsert,
}: {
  placeholders: string[];
  missing: Set<string>;
  onInsert: (token: string) => void;
}) {
  if (placeholders.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[11px] text-zinc-500">Platzhalter:</span>
      {placeholders.map((token) => {
        const isMissing = missing.has(token);
        return (
          <button
            key={token}
            type="button"
            onMouseDown={keepFocus}
            onClick={() => onInsert(token)}
            title={`„${token}“ an Cursor-Position einfügen`}
            className={`inline-flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
              isMissing
                ? "border-amber-800/70 bg-amber-950/30 text-amber-300 hover:border-amber-600/80 hover:bg-amber-950/60"
                : "border-emerald-900/70 bg-emerald-950/30 text-emerald-400/90 hover:border-emerald-700"
            }`}
          >
            {!isMissing && <CheckIcon className="h-2.5 w-2.5" />}
            <span>{token}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MissingPlaceholderWarning({
  missing,
  onInsert,
}: {
  missing: string[];
  onInsert: (token: string) => void;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-300"
    >
      <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
      <div className="min-w-0 flex-1 leading-relaxed">
        <span>
          {missing.length === 1
            ? "Fehlender Platzhalter in der Übersetzung: "
            : "Fehlende Platzhalter in der Übersetzung: "}
        </span>
        <span className="inline-flex flex-wrap items-center gap-1">
          {missing.map((token) => (
            <button
              key={token}
              type="button"
              onMouseDown={keepFocus}
              onClick={() => onInsert(token)}
              className="cursor-pointer rounded border border-amber-800/80 bg-amber-950/60 px-1 py-0.5 font-mono text-[11px] text-amber-200 hover:bg-amber-900/60"
            >
              {token}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
