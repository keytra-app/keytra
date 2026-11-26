"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreateKeyModal } from "@/components/keys/create-key-modal";
import { DeleteKeyModal, EditKeyModal } from "@/components/keys/key-modals";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { saveTranslationAction } from "@/lib/editor/actions";
import type { EditorKeyItem, EditorPageData, SourceKey } from "@/lib/editor/queries";
import { EditorHeader } from "./editor-header";
import { ALL_NAMESPACES, getKeyStatus, type KeyFilter, KeyListSidebar } from "./key-list-sidebar";
import { TranslationPane } from "./translation-pane";

function sortKeys(list: EditorKeyItem[]): EditorKeyItem[] {
  return [...list].sort(
    (a, b) => a.namespace.localeCompare(b.namespace) || a.key.localeCompare(b.key),
  );
}

export function TranslationEditor({ data }: { data: EditorPageData }) {
  const { toast } = useToast();
  const isAdmin = data.user.role === "admin";

  const [keys, setKeys] = useState<EditorKeyItem[]>(data.keys);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<KeyFilter>("all");
  const [selectedNamespace, setSelectedNamespace] = useState<string>(ALL_NAMESPACES);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(() => {
    const firstOpen = data.keys.find((k) => getKeyStatus(k) !== "translated");
    return firstOpen?.id ?? data.keys[0]?.id ?? null;
  });

  // Responsive mobile view toggle (list vs editor)
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");

  // Pending optimistic saves count for subtle indicator
  const [pendingSaves, setPendingSaves] = useState(0);
  const saveSeqRef = useRef<Map<string, number>>(new Map());

  // Modals & inline editing state (suppresses global editor shortcuts while open)
  const [createOpen, setCreateOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<SourceKey | null>(null);
  const [deletingKey, setDeletingKey] = useState<SourceKey | null>(null);
  const [inlineDescEditing, setInlineDescEditing] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const modalOpen = createOpen || Boolean(editingKey) || Boolean(deletingKey);

  const focusTextarea = useCallback(() => {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  }, []);

  // Auto-focus target textarea on initial desktop load when a key is active
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      focusTextarea();
    }
  }, [focusTextarea]);

  // Unique sorted namespaces
  const namespaces = useMemo(() => {
    const set = new Set(keys.map((k) => k.namespace));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [keys]);

  // If the selected namespace no longer exists (e.g., last key deleted), fall back to all
  const activeNamespace =
    selectedNamespace !== ALL_NAMESPACES && !namespaces.includes(selectedNamespace)
      ? ALL_NAMESPACES
      : selectedNamespace;

  // Global project progress (always across all keys for header)
  const globalStats = useMemo(() => {
    let translated = 0;
    let outdated = 0;
    for (const k of keys) {
      const s = getKeyStatus(k);
      if (s === "translated") translated++;
      else if (s === "outdated") outdated++;
    }
    return { translated, outdated, total: keys.length };
  }, [keys]);

  // Keys scoped by namespace + search (used for filter tab counts)
  const namespaceAndSearchKeys = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return keys.filter((item) => {
      if (activeNamespace !== ALL_NAMESPACES && item.namespace !== activeNamespace) {
        return false;
      }
      if (!q) return true;
      const targetText = drafts[item.id] ?? item.translation?.value ?? "";
      return (
        item.key.toLowerCase().includes(q) ||
        item.namespace.toLowerCase().includes(q) ||
        item.sourceValue.toLowerCase().includes(q) ||
        targetText.toLowerCase().includes(q)
      );
    });
  }, [keys, activeNamespace, searchQuery, drafts]);

  // Filter tab counts (live within current namespace/search)
  const filterCounts = useMemo<Record<KeyFilter, number>>(() => {
    let untranslated = 0;
    let outdated = 0;
    let translated = 0;
    for (const item of namespaceAndSearchKeys) {
      const s = getKeyStatus(item);
      if (s === "untranslated") untranslated++;
      else if (s === "outdated") outdated++;
      else translated++;
    }
    return {
      all: namespaceAndSearchKeys.length,
      untranslated,
      outdated,
      translated,
    };
  }, [namespaceAndSearchKeys]);

  // Final filtered list displayed in left sidebar
  const filteredKeys = useMemo(() => {
    if (filter === "all") return namespaceAndSearchKeys;
    return namespaceAndSearchKeys.filter((item) => getKeyStatus(item) === filter);
  }, [namespaceAndSearchKeys, filter]);

  // Effective selected key (falls back cleanly if current selection isn't in filteredKeys)
  const effectiveSelectedId = useMemo(() => {
    if (selectedKeyId && filteredKeys.some((k) => k.id === selectedKeyId)) {
      return selectedKeyId;
    }
    return filteredKeys[0]?.id ?? null;
  }, [selectedKeyId, filteredKeys]);

  const selectedKey = useMemo(
    () => keys.find((k) => k.id === effectiveSelectedId) ?? null,
    [keys, effectiveSelectedId],
  );

  const currentValue = selectedKey
    ? (drafts[selectedKey.id] ?? selectedKey.translation?.value ?? "")
    : "";

  const isDirty = selectedKey
    ? drafts[selectedKey.id] !== undefined &&
      drafts[selectedKey.id] !== (selectedKey.translation?.value ?? "")
    : false;

  const handleSelectKey = useCallback(
    (keyId: string, shouldFocus = true) => {
      setSelectedKeyId(keyId);
      setMobileView("editor");
      setInlineDescEditing(false);
      if (shouldFocus) focusTextarea();
    },
    [focusTextarea],
  );

  const handleStepKey = useCallback(
    (delta: -1 | 1) => {
      if (filteredKeys.length === 0) return;
      const idx = filteredKeys.findIndex((k) => k.id === effectiveSelectedId);
      const nextIdx =
        idx === -1
          ? 0
          : Math.max(0, Math.min(filteredKeys.length - 1, idx + delta));
      const target = filteredKeys[nextIdx];
      if (target && target.id !== effectiveSelectedId) {
        handleSelectKey(target.id, true);
      }
    },
    [filteredKeys, effectiveSelectedId, handleSelectKey],
  );

  const handleSaveCurrent = useCallback(() => {
    if (!selectedKey) return;

    const keyId = selectedKey.id;
    const valueToSave = drafts[keyId] ?? selectedKey.translation?.value ?? "";
    const status = getKeyStatus(selectedKey);
    const dirty =
      drafts[keyId] !== undefined && drafts[keyId] !== (selectedKey.translation?.value ?? "");

    if (valueToSave.trim() === "" && selectedKey.sourceValue.trim() !== "") {
      toast("Übersetzung darf nicht leer sein.", "error");
      return;
    }

    // Already translated and unchanged — still allow jumping to next open key if triggered by shortcut?
    if (!dirty && status === "translated") {
      return;
    }

    // Compute next open (untranslated or outdated) key in the CURRENT filtered list before mutating
    const currentIndex = filteredKeys.findIndex((k) => k.id === keyId);
    let nextOpenKey: EditorKeyItem | null = null;
    if (currentIndex !== -1) {
      for (let i = currentIndex + 1; i < filteredKeys.length; i++) {
        if (getKeyStatus(filteredKeys[i]) !== "translated") {
          nextOpenKey = filteredKeys[i];
          break;
        }
      }
      if (!nextOpenKey) {
        for (let i = 0; i < currentIndex; i++) {
          if (getKeyStatus(filteredKeys[i]) !== "translated") {
            nextOpenKey = filteredKeys[i];
            break;
          }
        }
      }
    }

    const previousTranslation = selectedKey.translation;
    const optimisticNow = new Date().toISOString();
    const seq = (saveSeqRef.current.get(keyId) ?? 0) + 1;
    saveSeqRef.current.set(keyId, seq);

    // 1. Optimistic state update (zero lag)
    setKeys((prev) =>
      prev.map((k) =>
        k.id === keyId
          ? {
              ...k,
              translation: {
                value: valueToSave,
                status: "translated",
                updatedAt: optimisticNow,
                updatedByName: data.user.name,
              },
            }
          : k,
      ),
    );
    setDrafts((prev) => {
      if (!(keyId in prev)) return prev;
      const next = { ...prev };
      delete next[keyId];
      return next;
    });

    // 2. Immediately jump to next open/outdated key & auto-focus textarea
    if (nextOpenKey) {
      setSelectedKeyId(nextOpenKey.id);
      focusTextarea();
    } else if (filter === "untranslated" || filter === "outdated") {
      setSelectedKeyId(null);
      toast("Alle offenen Keys in diesem Filter erledigt.");
    } else {
      toast("Übersetzung gespeichert.");
    }

    // 3. Persist via Server Action in background with sequence-safe rollback on error
    setPendingSaves((n) => n + 1);
    void saveTranslationAction({
      projectId: data.project.id,
      keyId,
      localeId: data.locale.id,
      value: valueToSave,
      sourceValue: selectedKey.sourceValue,
    })
      .then((res) => {
        if (saveSeqRef.current.get(keyId) !== seq) return;
        if (!res.ok) {
          setKeys((prev) =>
            prev.map((k) =>
              k.id === keyId ? { ...k, translation: previousTranslation } : k,
            ),
          );
          setDrafts((prev) => ({ ...prev, [keyId]: valueToSave }));
          toast(res.error, "error");
          return;
        }
        setKeys((prev) =>
          prev.map((k) =>
            k.id === keyId && k.translation
              ? {
                  ...k,
                  translation: {
                    ...k.translation,
                    updatedAt: res.updatedAt,
                    updatedByName: res.updatedByName,
                  },
                }
              : k,
          ),
        );
      })
      .catch(() => {
        if (saveSeqRef.current.get(keyId) !== seq) return;
        setKeys((prev) =>
          prev.map((k) =>
            k.id === keyId ? { ...k, translation: previousTranslation } : k,
          ),
        );
        setDrafts((prev) => ({ ...prev, [keyId]: valueToSave }));
        toast("Speichern fehlgeschlagen. Bitte erneut versuchen.", "error");
      })
      .finally(() => {
        setPendingSaves((n) => Math.max(0, n - 1));
      });
  }, [
    selectedKey,
    drafts,
    filteredKeys,
    filter,
    data.user.name,
    data.project.id,
    data.locale.id,
    focusTextarea,
    toast,
  ]);

  // Global keyboard shortcuts (clean, conflict-free)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (modalOpen) return;

      // Cmd/Ctrl + K -> focus search input
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMobileView("list");
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
        return;
      }

      // Cmd/Ctrl + Enter -> save & jump to next open key (skip when editing inline description)
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === "Enter") {
        if (inlineDescEditing) return;
        e.preventDefault();
        handleSaveCurrent();
        return;
      }

      // Alt + ArrowUp / Alt + ArrowDown -> previous / next key in filtered list
      if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          handleStepKey(-1);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          handleStepKey(1);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, inlineDescEditing, handleSaveCurrent, handleStepKey]);

  function handleCreatedKey(created: SourceKey, keepOpen: boolean) {
    const item: EditorKeyItem = { ...created, translation: null, references: [] };
    setKeys((prev) => sortKeys([...prev, item]));
    if (activeNamespace !== ALL_NAMESPACES && activeNamespace !== item.namespace) {
      setSelectedNamespace(ALL_NAMESPACES);
    }
    if (filter === "translated" || filter === "outdated") {
      setFilter("all");
    }
    setSearchQuery("");
    setSelectedKeyId(item.id);
    setMobileView("editor");
    // While the modal stays open for the next key, it keeps the focus.
    if (!keepOpen) focusTextarea();
  }

  function handleUpdatedKey(payload: {
    keyId: string;
    sourceValue: string;
    description: string | null;
    sourceChanged: boolean;
  }) {
    setKeys((prev) =>
      prev.map((k) => {
        if (k.id !== payload.keyId) return k;
        const nextTranslation =
          payload.sourceChanged && k.translation?.status === "translated"
            ? { ...k.translation, status: "outdated" as const }
            : k.translation;
        return {
          ...k,
          sourceValue: payload.sourceValue,
          description: payload.description,
          translation: nextTranslation,
          references: payload.sourceChanged ? [] : k.references,
        };
      }),
    );
  }

  function handleDescriptionSaved(keyId: string, description: string | null) {
    setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, description } : k)));
  }

  function handleDeletedKey(keyId: string) {
    const idx = filteredKeys.findIndex((k) => k.id === keyId);
    const neighbor = filteredKeys[idx + 1] ?? filteredKeys[idx - 1] ?? null;

    setKeys((prev) => prev.filter((k) => k.id !== keyId));
    setDrafts((prev) => {
      if (!(keyId in prev)) return prev;
      const next = { ...prev };
      delete next[keyId];
      return next;
    });
    setSelectedKeyId(neighbor?.id ?? null);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#09090b]">
      <EditorHeader
        projectName={data.project.name}
        projectSlug={data.project.slug}
        sourceLocale={data.project.sourceLocale}
        activeLocale={data.locale}
        locales={data.locales}
        translatedCount={globalStats.translated}
        outdatedCount={globalStats.outdated}
        totalCount={globalStats.total}
        pendingSaves={pendingSaves}
        isAdmin={isAdmin}
        onOpenCreateKey={() => setCreateOpen(true)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Pane (~35–40%) */}
        <div
          className={`${
            mobileView === "editor" ? "hidden md:flex" : "flex"
          } w-full shrink-0 flex-col border-zinc-800 md:w-[38%] md:min-w-[300px] md:max-w-[480px] md:border-r`}
        >
          <KeyListSidebar
            searchInputRef={searchInputRef}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchJumpToEditor={() => {
              if (effectiveSelectedId) {
                setMobileView("editor");
                focusTextarea();
              }
            }}
            filter={filter}
            onFilterChange={setFilter}
            counts={filterCounts}
            namespaces={namespaces}
            selectedNamespace={activeNamespace}
            onNamespaceChange={setSelectedNamespace}
            items={filteredKeys}
            selectedKeyId={effectiveSelectedId}
            drafts={drafts}
            onSelectKey={(id) => handleSelectKey(id, true)}
          />
        </div>

        {/* Right Pane (~60–65%) */}
        <main
          className={`${
            mobileView === "list" ? "hidden md:flex" : "flex"
          } min-w-0 flex-1 flex-col overflow-hidden`}
        >
          {selectedKey ? (
            <TranslationPane
              projectId={data.project.id}
              sourceLocale={data.project.sourceLocale}
              activeLocale={data.locale}
              item={selectedKey}
              value={currentValue}
              isDirty={isDirty}
              isAdmin={isAdmin}
              textareaRef={textareaRef}
              onChangeValue={(next) => {
                setDrafts((prev) => ({ ...prev, [selectedKey.id]: next }));
              }}
              onDiscardDraft={() => {
                setDrafts((prev) => {
                  const next = { ...prev };
                  delete next[selectedKey.id];
                  return next;
                });
              }}
              onSave={handleSaveCurrent}
              onDescriptionSaved={handleDescriptionSaved}
              onOpenEditKey={(item) => setEditingKey(item)}
              onOpenDeleteKey={(item) => setDeletingKey(item)}
              onBackToListMobile={() => setMobileView("list")}
              onInlineEditingChange={setInlineDescEditing}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              {keys.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-zinc-200">Noch keine Keys im Projekt</p>
                  <p className="max-w-sm text-xs text-zinc-500">
                    {isAdmin
                      ? "Lege deinen ersten Key direkt hier an oder pushe deine Source-Datei über die API."
                      : "Ein Administrator hat noch keine Übersetzungs-Keys angelegt."}
                  </p>
                  {isAdmin && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-1"
                      onClick={() => setCreateOpen(true)}
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      <span>Ersten Key hinzufügen</span>
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-200">
                    {filter === "untranslated"
                      ? "Alle Keys sind übersetzt"
                      : filter === "outdated"
                        ? "Keine veralteten Keys"
                        : "Kein Key ausgewählt"}
                  </p>
                  <p className="max-w-xs text-xs text-zinc-500">
                    {searchQuery || filter !== "all" || activeNamespace !== ALL_NAMESPACES
                      ? "Wechsle den Filter oder leere die Suche, um weitere Keys anzuzeigen."
                      : "Wähle links einen Key aus der Liste aus."}
                  </p>
                  {(searchQuery || filter !== "all" || activeNamespace !== ALL_NAMESPACES) && (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setSearchQuery("");
                        setFilter("all");
                        setSelectedNamespace(ALL_NAMESPACES);
                      }}
                    >
                      Filter zurücksetzen
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Admin Modals */}
      {isAdmin && createOpen && (
        <CreateKeyModal
          onClose={() => setCreateOpen(false)}
          projects={[{ ...data.project, namespaces }]}
          defaultNamespace={activeNamespace === ALL_NAMESPACES ? undefined : activeNamespace}
          onCreated={handleCreatedKey}
        />
      )}

      {isAdmin && editingKey && (
        <EditKeyModal
          key={editingKey.id}
          item={editingKey}
          onClose={() => setEditingKey(null)}
          projectId={data.project.id}
          sourceLocale={data.project.sourceLocale}
          onUpdated={handleUpdatedKey}
        />
      )}

      {isAdmin && (
        <DeleteKeyModal
          item={deletingKey}
          onClose={() => setDeletingKey(null)}
          projectId={data.project.id}
          onDeleted={handleDeletedKey}
        />
      )}
    </div>
  );
}
