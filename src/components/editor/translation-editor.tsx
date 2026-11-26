"use client";

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreateKeyModal } from "@/components/keys/create-key-modal";
import { DeleteKeyModal, EditKeyModal } from "@/components/keys/key-modals";
import { useToast } from "@/components/ui/toast";
import type { EditorPageData, SourceKey } from "@/lib/editor/queries";
import { EditorEmptyState } from "./editor-empty-state";
import { EditorHeader } from "./editor-header";
import { KeyListSidebar } from "./key-list-sidebar";
import {
  ALL_NAMESPACES,
  countByStatus,
  currentValue,
  findNextOpenKey,
  getKeyStatus,
  hasUnsavedDraft,
  isOpen,
} from "./key-status";
import { TranslationPane } from "./translation-pane";
import { useEditorKeys } from "./use-editor-keys";
import { useEditorShortcuts } from "./use-editor-shortcuts";
import { useKeyFilters } from "./use-key-filters";
import { useKeySelection } from "./use-key-selection";

/** Reads the ref inside the frame, after React has mounted a newly selected key's textarea. */
function focusAtEnd(ref: RefObject<HTMLTextAreaElement | null>) {
  requestAnimationFrame(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });
}

export function TranslationEditor({ data }: { data: EditorPageData }) {
  const { toast } = useToast();
  const isAdmin = data.user.role === "admin";

  const editorKeys = useEditorKeys(data);
  const { keys, drafts, persistTranslation } = editorKeys;
  const filters = useKeyFilters(keys, drafts);
  const { filteredKeys, filter, activeNamespace } = filters;

  const [mobileView, setMobileView] = useState<"list" | "editor">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<SourceKey | null>(null);
  const [deletingKey, setDeletingKey] = useState<SourceKey | null>(null);
  const [inlineDescEditing, setInlineDescEditing] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const focusTextarea = useCallback(() => focusAtEnd(textareaRef), []);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) focusTextarea();
  }, [focusTextarea]);

  const globalStats = useMemo(() => countByStatus(keys), [keys]);

  const onSelect = useCallback(() => {
    setMobileView("editor");
    setInlineDescEditing(false);
    focusTextarea();
  }, [focusTextarea]);
  const { selectedId, setSelectedKeyId, selectKey, stepKey } = useKeySelection(
    filteredKeys,
    (data.keys.find(isOpen) ?? data.keys[0])?.id ?? null,
    onSelect,
  );
  const selectedKey = keys.find((k) => k.id === selectedId) ?? null;

  const saveCurrent = useCallback(() => {
    if (!selectedKey) return;

    const value = currentValue(selectedKey, drafts);
    if (value.trim() === "" && selectedKey.sourceValue.trim() !== "") {
      toast("Übersetzung darf nicht leer sein.", "error");
      return;
    }
    if (!hasUnsavedDraft(selectedKey, drafts) && getKeyStatus(selectedKey) === "translated") return;

    // Computed before the optimistic update changes the key's status.
    const nextOpenKey = findNextOpenKey(filteredKeys, selectedKey.id);
    persistTranslation(selectedKey, value);

    if (nextOpenKey) {
      setSelectedKeyId(nextOpenKey.id);
      focusTextarea();
    } else if (filter === "untranslated" || filter === "outdated") {
      setSelectedKeyId(null);
      toast("Alle offenen Keys in diesem Filter erledigt.");
    } else {
      toast("Übersetzung gespeichert.");
    }
  }, [
    selectedKey,
    drafts,
    filteredKeys,
    filter,
    persistTranslation,
    setSelectedKeyId,
    focusTextarea,
    toast,
  ]);

  const focusSearch = useCallback(() => {
    setMobileView("list");
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  useEditorShortcuts({
    disabled: createOpen || Boolean(editingKey) || Boolean(deletingKey),
    saveDisabled: inlineDescEditing,
    onSearch: focusSearch,
    onSave: saveCurrent,
    onStep: stepKey,
  });

  function handleCreatedKey(created: SourceKey, keepOpen: boolean) {
    const item = editorKeys.addKey(created);
    if (activeNamespace !== ALL_NAMESPACES && activeNamespace !== item.namespace) {
      filters.setSelectedNamespace(ALL_NAMESPACES);
    }
    if (filter === "translated" || filter === "outdated") filters.setFilter("all");
    filters.setSearchQuery("");
    setSelectedKeyId(item.id);
    setMobileView("editor");
    // While the modal stays open for the next key, it keeps the focus.
    if (!keepOpen) focusTextarea();
  }

  function handleDeletedKey(keyId: string) {
    const index = filteredKeys.findIndex((k) => k.id === keyId);
    const neighbor = filteredKeys[index + 1] ?? filteredKeys[index - 1] ?? null;
    editorKeys.removeKey(keyId);
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
        totalCount={globalStats.all}
        pendingSaves={editorKeys.pendingSaves}
        isAdmin={isAdmin}
        onOpenCreateKey={() => setCreateOpen(true)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`${
            mobileView === "editor" ? "hidden md:flex" : "flex"
          } w-full shrink-0 flex-col border-zinc-800 md:w-[38%] md:max-w-[480px] md:min-w-[300px] md:border-r`}
        >
          <KeyListSidebar
            searchInputRef={searchInputRef}
            searchQuery={filters.searchQuery}
            onSearchChange={filters.setSearchQuery}
            onSearchJumpToEditor={() => {
              if (!selectedId) return;
              setMobileView("editor");
              focusTextarea();
            }}
            filter={filter}
            onFilterChange={filters.setFilter}
            counts={filters.counts}
            namespaces={filters.namespaces}
            selectedNamespace={activeNamespace}
            onNamespaceChange={filters.setSelectedNamespace}
            items={filteredKeys}
            selectedKeyId={selectedId}
            drafts={drafts}
            onSelectKey={selectKey}
          />
        </div>

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
              value={currentValue(selectedKey, drafts)}
              isDirty={hasUnsavedDraft(selectedKey, drafts)}
              isAdmin={isAdmin}
              textareaRef={textareaRef}
              onChangeValue={(next) => editorKeys.setDraft(selectedKey.id, next)}
              onDiscardDraft={() => editorKeys.discardDraft(selectedKey.id)}
              onSave={saveCurrent}
              onDescriptionSaved={editorKeys.setDescription}
              onOpenEditKey={setEditingKey}
              onOpenDeleteKey={setDeletingKey}
              onBackToListMobile={() => setMobileView("list")}
              onInlineEditingChange={setInlineDescEditing}
            />
          ) : (
            <EditorEmptyState
              hasKeys={keys.length > 0}
              isAdmin={isAdmin}
              filter={filter}
              isFiltered={filters.isFiltered}
              onCreateKey={() => setCreateOpen(true)}
              onResetFilters={filters.resetFilters}
            />
          )}
        </main>
      </div>

      {isAdmin && createOpen && (
        <CreateKeyModal
          onClose={() => setCreateOpen(false)}
          projects={[{ ...data.project, namespaces: filters.namespaces }]}
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
          onUpdated={editorKeys.applyKeyUpdate}
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
