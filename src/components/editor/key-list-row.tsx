import type { EditorKeyItem, EditorTranslationStatus } from "@/lib/editor/queries";
import { type Drafts, getKeyStatus, hasUnsavedDraft } from "./key-status";

const STATUS_DOT: Record<EditorTranslationStatus, { className: string; title: string }> = {
  translated: { className: "bg-emerald-400", title: "Übersetzt" },
  outdated: { className: "bg-amber-400", title: "Veraltet" },
  untranslated: { className: "bg-zinc-600", title: "Unübersetzt" },
};

export function KeyListRow({
  item,
  drafts,
  selected,
  showNamespace,
  rowRef,
  onSelect,
}: {
  item: EditorKeyItem;
  drafts: Drafts;
  selected: boolean;
  showNamespace: boolean;
  rowRef: (el: HTMLButtonElement | null) => void;
  onSelect: () => void;
}) {
  const dot = STATUS_DOT[getKeyStatus(item)];
  const draft = drafts[item.id];
  const isDirty = hasUnsavedDraft(item, drafts);
  const previewText = draft ?? item.translation?.value ?? item.sourceValue;
  const showingSourceFallback = draft === undefined && item.translation === null;

  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onSelect}
      className={`group flex w-full cursor-pointer items-start gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-l-zinc-100 bg-[#161619]"
          : "border-l-transparent bg-transparent hover:bg-[#111113]"
      }`}
    >
      <span
        title={dot.title}
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot.className} ${
          isDirty ? "ring-2 ring-zinc-400/50 ring-offset-1 ring-offset-[#09090b]" : ""
        }`}
      />

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`truncate font-mono text-xs ${
              selected ? "font-medium text-zinc-100" : "text-zinc-200 group-hover:text-zinc-100"
            }`}
          >
            {item.key}
          </span>
          {showNamespace && (
            <span className="shrink-0 rounded border border-zinc-800 bg-[#09090b] px-1 py-0.5 font-mono text-[10px] leading-none text-zinc-500">
              {item.namespace}
            </span>
          )}
          {isDirty && (
            <span className="shrink-0 text-[10px] text-zinc-500" title="Ungespeicherte Änderung">
              ●
            </span>
          )}
        </div>
        <p
          className={`truncate text-[11px] leading-snug ${
            showingSourceFallback ? "text-zinc-600" : "text-zinc-400"
          }`}
        >
          {previewText || <span className="text-zinc-700 italic">(leer)</span>}
        </p>
      </div>
    </button>
  );
}
