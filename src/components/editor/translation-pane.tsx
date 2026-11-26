"use client";

import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  CornerDownLeftIcon,
  EditIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateKeyAction } from "@/lib/editor/actions";
import type { EditorKeyItem, EditorLocaleOption } from "@/lib/editor/queries";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/editor/time";
import { extractPlaceholders, getMissingPlaceholders } from "@/lib/i18n/placeholders";
import { getKeyStatus } from "./key-list-sidebar";

function StatusBadge({ status }: { status: "untranslated" | "outdated" | "translated" }) {
  if (status === "translated") return <Badge variant="success">Übersetzt</Badge>;
  if (status === "outdated") return <Badge variant="warning">Veraltet</Badge>;
  return <Badge variant="neutral">Unübersetzt</Badge>;
}

function InlineDescription({
  projectId,
  item,
  isAdmin,
  onDescriptionSaved,
  onEditingChange,
}: {
  projectId: string;
  item: EditorKeyItem;
  isAdmin: boolean;
  onDescriptionSaved: (keyId: string, description: string | null) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.description ?? "");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function startEditing() {
    setDraft(item.description ?? "");
    setEditing(true);
    onEditingChange(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function cancelEditing() {
    setEditing(false);
    onEditingChange(false);
  }

  function saveDescription() {
    const trimmed = draft.trim();
    const nextDesc = trimmed || null;
    if (nextDesc === (item.description ?? null)) {
      cancelEditing();
      return;
    }

    startTransition(async () => {
      const res = await updateKeyAction({
        projectId,
        keyId: item.id,
        description: nextDesc,
      });
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      onDescriptionSaved(item.id, res.description);
      toast("Kontext gespeichert.");
      setEditing(false);
      onEditingChange(false);
    });
  }

  if (!isAdmin && !item.description) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-md border border-zinc-800/80 bg-[#111113]/70 px-3.5 py-2.5">
        <p className="text-[11px] font-medium text-zinc-500">Kontext</p>
        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
          {item.description}
        </p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-md border border-zinc-700 bg-[#111113] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-400">Kontext / Beschreibung</span>
          <span className="text-[10px] text-zinc-600">Esc zum Abbrechen · ⌘↵ Speichern</span>
        </div>
        <Textarea
          ref={inputRef}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              cancelEditing();
            } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              saveDescription();
            }
          }}
          placeholder="Hinweis für Übersetzer hinzufügen …"
          maxLength={1000}
          className="text-xs"
        />
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="ghost" size="xs" onClick={cancelEditing} disabled={pending}>
            Abbrechen
          </Button>
          <Button variant="primary" size="xs" onClick={saveDescription} disabled={pending}>
            {pending ? "Speichere …" : "Speichern"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="group flex w-full items-start justify-between gap-3 rounded-md border border-zinc-800/80 bg-[#111113]/60 px-3.5 py-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-[#111113] cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-zinc-500">Kontext</p>
        {item.description ? (
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
            {item.description}
          </p>
        ) : (
          <p className="mt-1 text-xs text-zinc-600 group-hover:text-zinc-500">
            Kontext oder Hinweis für Übersetzer hinzufügen …
          </p>
        )}
      </div>
      <EditIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300" />
    </button>
  );
}

function ReferenceRow({
  localeCode,
  localeName,
  value,
}: {
  localeCode: string;
  localeName: string;
  value: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast(`Referenz (${localeCode}) kopiert.`);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("Kopieren fehlgeschlagen.", "error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Klicken zum Kopieren"
      className="group flex w-full items-start justify-between gap-3 rounded-md border border-zinc-800/80 bg-[#09090b] px-3 py-2 text-left transition-colors hover:border-zinc-700 hover:bg-[#111113] cursor-pointer"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-zinc-300">{localeCode}</span>
          <span className="text-[11px] text-zinc-500">{localeName}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-300">
          {value}
        </p>
      </div>
      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11px] text-zinc-500 transition-colors group-hover:text-zinc-200">
        {copied ? (
          <>
            <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-400">Kopiert</span>
          </>
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
      </span>
    </button>
  );
}

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
  const [refsOpen, setRefsOpen] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const status = getKeyStatus(item);
  const placeholders = extractPlaceholders(item.sourceValue);
  const missingPlaceholders = getMissingPlaceholders(item.sourceValue, value);
  const missingSet = new Set(missingPlaceholders);

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
    const nextValue = value.slice(0, start) + token + value.slice(end);
    const nextCursor = start + token.length;

    onChangeValue(nextValue);
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
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 cursor-pointer"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          <span>Zur Key-Liste</span>
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6 sm:px-8">
        {/* Key Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 pb-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all font-mono text-sm font-medium text-zinc-100">
                {item.key}
              </code>
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
              <StatusBadge status={status} />
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
                onClick={() => onOpenEditKey(item)}
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
                onClick={() => onOpenDeleteKey(item)}
                className="px-1.5 text-zinc-500 hover:text-red-400"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Source Language Card */}
        <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#111113]">
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-3.5 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-zinc-400">Quellsprache</span>
              <span className="rounded border border-zinc-800 bg-[#09090b] px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-300">
                {sourceLocale}
              </span>
            </div>
            <CopyButton
              value={item.sourceValue}
              label="Quelle kopieren"
              copiedLabel="Kopiert"
              toastMessage="Quelltext kopiert."
              variant="ghost"
              size="xs"
              className="h-6 px-2 text-[11px] text-zinc-400 hover:text-zinc-100"
            />
          </div>
          <div className="px-3.5 py-3">
            {item.sourceValue ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200 select-text">
                {item.sourceValue}
              </p>
            ) : (
              <p className="text-xs italic text-zinc-600">(Leerer Quelltext)</p>
            )}
          </div>
        </section>

        {/* Developer Context / Description */}
        <InlineDescription
          key={item.id}
          projectId={projectId}
          item={item}
          isAdmin={isAdmin}
          onDescriptionSaved={onDescriptionSaved}
          onEditingChange={onInlineEditingChange}
        />

        {/* Target Editor */}
        <section className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label
                htmlFor="translation-target-input"
                className="text-xs font-medium text-zinc-300"
              >
                Übersetzung
              </label>
              <span className="rounded border border-zinc-800 bg-[#111113] px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-300">
                {activeLocale.code}
              </span>
              <span className="text-xs text-zinc-500">{activeLocale.name}</span>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-zinc-600">
              {value.length} Zeichen
            </span>
          </div>

          {placeholders.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[11px] text-zinc-500">Platzhalter:</span>
              {placeholders.map((token) => {
                const isMissing = missingSet.has(token);
                return (
                  <button
                    key={token}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertPlaceholder(token)}
                    title={`„${token}“ an Cursor-Position einfügen`}
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors cursor-pointer ${
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
          )}

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
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-300"
            >
              <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1 leading-relaxed">
                <span>
                  {missingPlaceholders.length === 1
                    ? "Fehlender Platzhalter in der Übersetzung: "
                    : "Fehlende Platzhalter in der Übersetzung: "}
                </span>
                <span className="inline-flex flex-wrap items-center gap-1">
                  {missingPlaceholders.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertPlaceholder(token)}
                      className="rounded border border-amber-800/80 bg-amber-950/60 px-1 py-0.5 font-mono text-[11px] text-amber-200 hover:bg-amber-900/60 cursor-pointer"
                    >
                      {token}
                    </button>
                  ))}
                </span>
              </div>
            </div>
          )}

          {/* Action Row & Meta */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="min-w-0 text-[11px] text-zinc-500">
              {item.translation ? (
                <span>
                  Zuletzt bearbeitet von{" "}
                  <span className="text-zinc-300">
                    {item.translation.updatedByName ?? "Import"}
                  </span>{" "}
                  ·{" "}
                  <time
                    dateTime={item.translation.updatedAt}
                    title={formatAbsoluteTime(item.translation.updatedAt)}
                    suppressHydrationWarning
                  >
                    {formatRelativeTime(item.translation.updatedAt, nowMs)}
                  </time>
                </span>
              ) : (
                <span>Noch nicht übersetzt</span>
              )}
            </div>

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

        {/* Reference Languages Peek */}
        <section className="border-t border-zinc-800/80 pt-4">
          <button
            type="button"
            onClick={() => setRefsOpen((prev) => !prev)}
            aria-expanded={refsOpen}
            className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-200 cursor-pointer"
          >
            <span className="flex items-center gap-1.5 font-medium">
              {refsOpen ? (
                <ChevronDownIcon className="h-3.5 w-3.5 text-zinc-500" />
              ) : (
                <ChevronRightIcon className="h-3.5 w-3.5 text-zinc-500" />
              )}
              <span>Referenz-Sprachen</span>
              <span className="rounded border border-zinc-800 bg-[#111113] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-zinc-400">
                {item.references.length}
              </span>
            </span>
            <span className="text-[11px] text-zinc-600">
              {refsOpen ? "Ausblenden" : "Andere Sprachen anzeigen"}
            </span>
          </button>

          {refsOpen && (
            <div className="mt-2.5 space-y-1.5">
              {item.references.length === 0 ? (
                <p className="rounded-md border border-dashed border-zinc-800/80 px-3 py-2.5 text-xs text-zinc-600">
                  Noch keine fertigen Übersetzungen dieses Keys in anderen Zielsprachen vorhanden.
                </p>
              ) : (
                item.references.map((ref) => (
                  <ReferenceRow
                    key={ref.localeCode}
                    localeCode={ref.localeCode}
                    localeName={ref.localeName}
                    value={ref.value}
                  />
                ))
              )}
            </div>
          )}
        </section>

        {/* Subtle Shortcut Footer */}
        <footer className="mt-auto hidden flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-900 pt-3 text-[11px] text-zinc-600 sm:flex">
          <span>
            <kbd className="font-mono text-zinc-500">⌘/Ctrl+↵</kbd> Speichern &amp; nächster
            offener Key
          </span>
          <span>
            <kbd className="font-mono text-zinc-500">Alt+↑/↓</kbd> Vorheriger / Nächster Key
          </span>
          <span>
            <kbd className="font-mono text-zinc-500">⌘/Ctrl+K</kbd> Suchen
          </span>
        </footer>
      </div>
    </div>
  );
}
