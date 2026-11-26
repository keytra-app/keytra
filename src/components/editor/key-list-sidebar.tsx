"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ChevronDownIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import type { EditorKeyItem, EditorTranslationStatus } from "@/lib/editor/queries";

export type KeyFilter = "all" | "untranslated" | "outdated" | "translated";

export const ALL_NAMESPACES = "__all__";

export function getKeyStatus(item: EditorKeyItem): EditorTranslationStatus {
  if (!item.translation) return "untranslated";
  return item.translation.status;
}

const FILTER_TABS: readonly { id: KeyFilter; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "untranslated", label: "Unübersetzt" },
  { id: "outdated", label: "Veraltet" },
  { id: "translated", label: "Übersetzt" },
];

export function KeyListSidebar({
  searchInputRef,
  searchQuery,
  onSearchChange,
  onSearchJumpToEditor,
  filter,
  onFilterChange,
  counts,
  namespaces,
  selectedNamespace,
  onNamespaceChange,
  items,
  selectedKeyId,
  drafts,
  onSelectKey,
}: {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchJumpToEditor: () => void;
  filter: KeyFilter;
  onFilterChange: (next: KeyFilter) => void;
  counts: Record<KeyFilter, number>;
  namespaces: string[];
  selectedNamespace: string;
  onNamespaceChange: (ns: string) => void;
  items: EditorKeyItem[];
  selectedKeyId: string | null;
  drafts: Record<string, string>;
  onSelectKey: (keyId: string) => void;
}) {
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!selectedKeyId) return;
    const node = rowRefs.current.get(selectedKeyId);
    node?.scrollIntoView({ block: "nearest" });
  }, [selectedKeyId]);

  const showNamespaceBadge = namespaces.length > 1 && selectedNamespace === ALL_NAMESPACES;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#09090b]">
      <div className="shrink-0 space-y-2.5 border-b border-zinc-800 p-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchQuery) {
                e.preventDefault();
                onSearchChange("");
              } else if (e.key === "Enter" && items.length > 0) {
                e.preventDefault();
                onSearchJumpToEditor();
              }
            }}
            placeholder="Key, Quelle oder Übersetzung suchen …"
            aria-label="Keys durchsuchen"
            className="h-8 w-full rounded-md border border-zinc-800 bg-[#111113] pr-14 pl-8 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-zinc-500"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Suche leeren"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-zinc-800 bg-[#09090b] px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-500">
              ⌘K
            </kbd>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Statusfilter"
          className="grid grid-cols-4 gap-1 rounded-md border border-zinc-800/80 bg-[#111113] p-0.5"
        >
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(tab.id)}
                className={`flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  active
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="truncate">{tab.label}</span>
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    active ? "text-zinc-300" : "text-zinc-600"
                  }`}
                >
                  {counts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        {namespaces.length > 1 ? (
          <div className="relative">
            <select
              aria-label="Namespace filtern"
              value={selectedNamespace}
              onChange={(e) => onNamespaceChange(e.target.value)}
              className="h-7 w-full appearance-none rounded-md border border-zinc-800 bg-[#111113] pr-7 pl-2.5 font-mono text-[11px] text-zinc-300 outline-none transition-colors hover:border-zinc-700 focus:border-zinc-500 cursor-pointer"
            >
              <option value={ALL_NAMESPACES}>Alle Namespaces ({namespaces.length})</option>
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>
                  {ns}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
          </div>
        ) : namespaces.length === 1 ? (
          <div className="flex items-center justify-between px-0.5 text-[11px] text-zinc-600">
            <span>Namespace</span>
            <span className="font-mono text-zinc-500">{namespaces[0]}</span>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-zinc-800/60">
        {items.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-xs font-medium text-zinc-400">Keine passenden Keys</p>
            <p className="mt-1 text-[11px] text-zinc-600">
              {searchQuery
                ? "Passe Suchbegriff oder Filter an."
                : "In diesem Filter gibt es aktuell keine Keys."}
            </p>
          </div>
        ) : (
          items.map((item) => {
            const status = getKeyStatus(item);
            const selected = item.id === selectedKeyId;
            const draftValue = drafts[item.id];
            const isDirty = draftValue !== undefined && draftValue !== (item.translation?.value ?? "");
            const previewText =
              draftValue !== undefined
                ? draftValue
                : item.translation?.value ?? item.sourceValue;
            const showingSourceFallback =
              draftValue === undefined && item.translation === null;

            const dotClass =
              status === "translated"
                ? "bg-emerald-400"
                : status === "outdated"
                  ? "bg-amber-400"
                  : "bg-zinc-600";

            const dotTitle =
              status === "translated"
                ? "Übersetzt"
                : status === "outdated"
                  ? "Veraltet"
                  : "Unübersetzt";

            return (
              <button
                key={item.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(item.id, el);
                  else rowRefs.current.delete(item.id);
                }}
                type="button"
                onClick={() => onSelectKey(item.id)}
                className={`group flex w-full items-start gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                  selected
                    ? "border-l-zinc-100 bg-[#161619]"
                    : "border-l-transparent bg-transparent hover:bg-[#111113]"
                }`}
              >
                <span
                  title={dotTitle}
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass} ${
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
                    {showNamespaceBadge && (
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
                    {previewText || <span className="italic text-zinc-700">(leer)</span>}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
