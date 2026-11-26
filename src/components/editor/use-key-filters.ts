"use client";

import { useMemo, useState } from "react";
import type { EditorKeyItem } from "@/lib/editor/queries";
import {
  ALL_NAMESPACES,
  countByStatus,
  currentValue,
  type Drafts,
  getKeyStatus,
  type KeyFilter,
} from "./key-status";

function matchesSearch(item: EditorKeyItem, query: string, drafts: Drafts) {
  return [item.key, item.namespace, item.sourceValue, currentValue(item, drafts)].some((text) =>
    text.toLowerCase().includes(query),
  );
}

/** Search, status filter and namespace selection of the editor's key list. */
export function useKeyFilters(keys: EditorKeyItem[], drafts: Drafts) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<KeyFilter>("all");
  const [selectedNamespace, setSelectedNamespace] = useState(ALL_NAMESPACES);

  const namespaces = useMemo(
    () => [...new Set(keys.map((k) => k.namespace))].sort((a, b) => a.localeCompare(b)),
    [keys],
  );

  // Falls back to all once the last key of the selected namespace is deleted.
  const activeNamespace = namespaces.includes(selectedNamespace)
    ? selectedNamespace
    : ALL_NAMESPACES;

  // Scoped by namespace and search only, so the filter tabs can show live counts.
  const scopedKeys = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return keys.filter(
      (item) =>
        (activeNamespace === ALL_NAMESPACES || item.namespace === activeNamespace) &&
        (!query || matchesSearch(item, query, drafts)),
    );
  }, [keys, activeNamespace, searchQuery, drafts]);

  const counts = useMemo(() => countByStatus(scopedKeys), [scopedKeys]);

  const filteredKeys = useMemo(
    () => (filter === "all" ? scopedKeys : scopedKeys.filter((k) => getKeyStatus(k) === filter)),
    [scopedKeys, filter],
  );

  const isFiltered = Boolean(searchQuery) || filter !== "all" || activeNamespace !== ALL_NAMESPACES;

  function resetFilters() {
    setSearchQuery("");
    setFilter("all");
    setSelectedNamespace(ALL_NAMESPACES);
  }

  return {
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    namespaces,
    activeNamespace,
    setSelectedNamespace,
    counts,
    filteredKeys,
    isFiltered,
    resetFilters,
  };
}
