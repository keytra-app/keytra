"use client";

import { type RefObject, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ArrowLeftIcon, CornerDownLeftIcon, EditIcon, TrashIcon } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/input";
import type {
  EditorKeyItem,
  EditorLocaleOption,
  EditorTranslation,
  EditorTranslationStatus,
} from "@/lib/editor/queries";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { extractPlaceholders, getMissingPlaceholders } from "@/lib/i18n/placeholders";
import { InlineDescription } from "./inline-description";
import { getKeyStatus } from "./key-status";
import { MissingPlaceholderWarning, PlaceholderChips } from "./placeholder-hints";
import { ReferenceLanguages } from "./reference-languages";

export function TranslationPane({
  projectId,
  sourceLocale,
  activeLocale,
  item,
  value,
  isDirty,
  isAdmin,
  textareaRef,
  onChangeValue,
  onDiscardDraft,
  onSave,
  onDescriptionSaved,
  onOpenEditKey,
  onOpenDeleteKey,
  onBackToListMobile,
  onInlineEditingChange,
}: {
  projectId: string;
  sourceLocale: string;
  activeLocale: EditorLocaleOption;
  item: EditorKeyItem;
  value: string;
  isDirty: boolean;
  isAdmin: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChangeValue: (next: string) => void;
  onDiscardDraft: () => void;
  onSave: () => void;
  onDescriptionSaved: (keyId: string, description: string | null) => void;
  onOpenEditKey: (item: EditorKeyItem) => void;
  onOpenDeleteKey: (item: EditorKeyItem) => void;
  onBackToListMobile: () => void;
  onInlineEditingChange: (editing: boolean) => void;
}) {
  const status = getKeyStatus(item);
  const placeholders = extractPlaceholders(item.sourceValue);
  const missingPlaceholders = getMissingPlaceholders(item.sourceValue, value);
  const showMissingWarning =
    missingPlaceholders.length > 0 && (value.length > 0 || item.translation !== null);

  const isEmptyForbidden = value.trim() === "" && item.sourceValue.trim() !== "";
  const canSave = !isEmptyForbidden && (isDirty || status !== "translated");

  function insertPlaceholder(token: string) {
    const el = textareaRef.current;
    if (!el) {
      onChangeValue(`${value}${token}`);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const nextCursor = start + token.length;
    onChangeValue(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#09090b]">
      <div className="flex items-center border-b border-zinc-800 px-4 py-2 md:hidden">
        <button
          type="button"
          onClick={onBackToListMobile}
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          <span>Zur Key-Liste</span>
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6 sm:px-8">
        <KeyHeader
          item={item}
          status={status}
          isDirty={isDirty}
          isAdmin={isAdmin}
          onEdit={() => onOpenEditKey(item)}
          onDelete={() => onOpenDeleteKey(item)}
        />

        <SourceCard sourceLocale={sourceLocale} sourceValue={item.sourceValue} />

        <InlineDescription
          key={item.id}
          projectId={projectId}
          item={item}
          isAdmin={isAdmin}
          onDescriptionSaved={onDescriptionSaved}
          onEditingChange={onInlineEditingChange}
        />

        <section className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label
                htmlFor="translation-target-input"
                className="text-xs font-medium text-zinc-300"
              >
                Übersetzung
              </label>
              <LocaleCode className="bg-[#111113]">{activeLocale.code}</LocaleCode>
              <span className="text-xs text-zinc-500">{activeLocale.name}</span>
            </div>
            <span className="font-mono text-[11px] text-zinc-600 tabular-nums">
              {value.length} Zeichen
            </span>
          </div>

          <PlaceholderChips
            placeholders={placeholders}
            missing={new Set(missingPlaceholders)}
            onInsert={insertPlaceholder}
          />

          <Textarea
            id="translation-target-input"
            ref={textareaRef}
            rows={5}
            value={value}
            onChange={(e) => onChangeValue(e.target.value)}
            placeholder={`Übersetzung für ${activeLocale.name} (${activeLocale.code}) eingeben …`}
            className="min-h-32 bg-[#111113] leading-relaxed focus:bg-[#09090b]"
          />

          {showMissingWarning && (
            <MissingPlaceholderWarning missing={missingPlaceholders} onInsert={insertPlaceholder} />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <LastEdited translation={item.translation} />
            <div className="flex shrink-0 items-center gap-2">
              {isDirty && (
                <Button variant="ghost" size="sm" onClick={onDiscardDraft}>
                  Verwerfen
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={onSave} disabled={!canSave}>
                <CornerDownLeftIcon className="h-3.5 w-3.5" />
                <span>Speichern</span>
                <kbd className="ml-0.5 hidden rounded border border-zinc-400/40 bg-zinc-200/70 px-1 py-0.5 font-mono text-[10px] leading-none text-zinc-800 sm:inline">
                  ⌘↵
                </kbd>
              </Button>
            </div>
          </div>
        </section>

        <ReferenceLanguages references={item.references} />

        <ShortcutFooter />
      </div>
    </div>
  );
}

const STATUS_BADGE = {
  translated: <Badge variant="success">Übersetzt</Badge>,
  outdated: <Badge variant="warning">Veraltet</Badge>,
  untranslated: <Badge variant="neutral">Unübersetzt</Badge>,
} satisfies Record<EditorTranslationStatus, React.ReactNode>;

function LocaleCode({ children, className }: { children: string; className: string }) {
  return (
    <span
      className={`rounded border border-zinc-800 px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-300 ${className}`}
    >
      {children}
    </span>
  );
}

function KeyHeader({
  item,
  status,
  isDirty,
  isAdmin,
  onEdit,
  onDelete,
}: {
  item: EditorKeyItem;
  status: EditorTranslationStatus;
  isDirty: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 pb-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-sm font-medium break-all text-zinc-100">{item.key}</code>
          <CopyButton
            value={item.key}
            label="Key"
            copiedLabel="Kopiert"
            toastMessage="Key kopiert."
            variant="ghost"
            size="xs"
            className="h-6 px-1.5 text-[11px] text-zinc-500 hover:text-zinc-200"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge mono className="text-zinc-400">
            {item.namespace}
          </Badge>
          {STATUS_BADGE[status]}
          {isDirty && (
            <span className="text-[11px] text-zinc-500">· Ungespeicherte Änderungen</span>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="secondary"
            size="xs"
            onClick={onEdit}
            title="Quelltext oder Beschreibung bearbeiten"
          >
            <EditIcon className="h-3 w-3" />
            <span>Bearbeiten</span>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            aria-label="Key löschen"
            title="Key löschen"
            onClick={onDelete}
            className="px-1.5 text-zinc-500 hover:text-red-400"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SourceCard({ sourceLocale, sourceValue }: { sourceLocale: string; sourceValue: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#111113]">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-zinc-400">Quellsprache</span>
          <LocaleCode className="bg-[#09090b]">{sourceLocale}</LocaleCode>
        </div>
        <CopyButton
          value={sourceValue}
          label="Quelle kopieren"
          copiedLabel="Kopiert"
          toastMessage="Quelltext kopiert."
          variant="ghost"
          size="xs"
          className="h-6 px-2 text-[11px] text-zinc-400 hover:text-zinc-100"
        />
      </div>
      <div className="px-3.5 py-3">
        {sourceValue ? (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-zinc-200 select-text">
            {sourceValue}
          </p>
        ) : (
          <p className="text-xs text-zinc-600 italic">(Leerer Quelltext)</p>
        )}
      </div>
    </section>
  );
}

function LastEdited({ translation }: { translation: EditorTranslation | null }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!translation) {
    return <div className="min-w-0 text-[11px] text-zinc-500">Noch nicht übersetzt</div>;
  }

  return (
    <div className="min-w-0 text-[11px] text-zinc-500">
      Zuletzt bearbeitet von{" "}
      <span className="text-zinc-300">{translation.updatedByName ?? "Import"}</span> ·{" "}
      <time
        dateTime={translation.updatedAt}
        title={formatDateTime(translation.updatedAt)}
        suppressHydrationWarning
      >
        {formatRelativeTime(translation.updatedAt, nowMs)}
      </time>
    </div>
  );
}

function ShortcutFooter() {
  return (
    <footer className="mt-auto hidden flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-900 pt-3 text-[11px] text-zinc-600 sm:flex">
      <span>
        <kbd className="font-mono text-zinc-500">⌘/Ctrl+↵</kbd> Speichern &amp; nächster offener Key
      </span>
      <span>
        <kbd className="font-mono text-zinc-500">Alt+↑/↓</kbd> Vorheriger / Nächster Key
      </span>
      <span>
        <kbd className="font-mono text-zinc-500">⌘/Ctrl+K</kbd> Suchen
      </span>
    </footer>
  );
}
