"use client";

import { type RefObject, useEffect, useRef } from "react";
import { ChevronDownIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import type { EditorKeyItem } from "@/lib/editor/queries";
import { KeyListRow } from "./key-list-row";
import { ALL_NAMESPACES, type Drafts, type KeyFilter } from "./key-status";

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
  drafts: Drafts;
  onSelectKey: (keyId: string) => void;
}) {
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (selectedKeyId) rowRefs.current.get(selectedKeyId)?.scrollIntoView({ block: "nearest" });
  }, [selectedKeyId]);

  const showNamespaceBadge = namespaces.length > 1 && selectedNamespace === ALL_NAMESPACES;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#09090b]">
      <div className="shrink-0 space-y-2.5 border-b border-zinc-800 p-3">
        <SearchField
          inputRef={searchInputRef}
          value={searchQuery}
          onChange={onSearchChange}
          onSubmit={items.length > 0 ? onSearchJumpToEditor : undefined}
        />
        <FilterTabs filter={filter} counts={counts} onChange={onFilterChange} />
        <NamespacePicker
          namespaces={namespaces}
          selected={selectedNamespace}
          onChange={onNamespaceChange}
        />
      </div>

      <div className="min-h-0 flex-1 divide-y divide-zinc-800/60 overflow-y-auto">
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
          items.map((item) => (
            <KeyListRow
              key={item.id}
              item={item}
              drafts={drafts}
              selected={item.id === selectedKeyId}
              showNamespace={showNamespaceBadge}
              rowRef={(el) => {
                if (el) rowRefs.current.set(item.id, el);
                else rowRefs.current.delete(item.id);
              }}
              onSelect={() => onSelectKey(item.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function SearchField({
  inputRef,
  value,
  onChange,
  onSubmit,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  /** Enter is left alone while there is nothing to jump to. */
  onSubmit?: () => void;
}) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          } else if (e.key === "Enter" && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Key, Quelle oder Übersetzung suchen …"
        aria-label="Keys durchsuchen"
        className="h-8 w-full rounded-md border border-zinc-800 bg-[#111113] pr-14 pl-8 text-xs text-zinc-100 transition-colors outline-none placeholder:text-zinc-600 focus:border-zinc-500"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Suche leeren"
          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-zinc-800 bg-[#09090b] px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-500">
          ⌘K
        </kbd>
      )}
    </div>
  );
}

function FilterTabs({
  filter,
  counts,
  onChange,
}: {
  filter: KeyFilter;
  counts: Record<KeyFilter, number>;
  onChange: (next: KeyFilter) => void;
}) {
  return (
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
            onClick={() => onChange(tab.id)}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
              active ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
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
  );
}

function NamespacePicker({
  namespaces,
  selected,
  onChange,
}: {
  namespaces: string[];
  selected: string;
  onChange: (ns: string) => void;
}) {
  if (namespaces.length === 0) return null;

  if (namespaces.length === 1) {
    return (
      <div className="flex items-center justify-between px-0.5 text-[11px] text-zinc-600">
        <span>Namespace</span>
        <span className="font-mono text-zinc-500">{namespaces[0]}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        aria-label="Namespace filtern"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-full cursor-pointer appearance-none rounded-md border border-zinc-800 bg-[#111113] pr-7 pl-2.5 font-mono text-[11px] text-zinc-300 transition-colors outline-none hover:border-zinc-700 focus:border-zinc-500"
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
  );
}
