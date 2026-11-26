import type { EditorKeyItem, EditorTranslationStatus } from "@/lib/editor/queries";

export type KeyFilter = "all" | EditorTranslationStatus;

export type Drafts = Record<string, string>;

export const ALL_NAMESPACES = "__all__";

export function getKeyStatus(item: EditorKeyItem): EditorTranslationStatus {
  return item.translation?.status ?? "untranslated";
}

export const isOpen = (item: EditorKeyItem) => getKeyStatus(item) !== "translated";

export function sortKeys(list: EditorKeyItem[]): EditorKeyItem[] {
  return [...list].sort(
    (a, b) => a.namespace.localeCompare(b.namespace) || a.key.localeCompare(b.key),
  );
}

export function countByStatus(items: EditorKeyItem[]): Record<KeyFilter, number> {
  const counts = { all: items.length, untranslated: 0, outdated: 0, translated: 0 };
  for (const item of items) counts[getKeyStatus(item)]++;
  return counts;
}

export const savedValue = (item: EditorKeyItem) => item.translation?.value ?? "";

export const currentValue = (item: EditorKeyItem, drafts: Drafts) =>
  drafts[item.id] ?? savedValue(item);

export function hasUnsavedDraft(item: EditorKeyItem, drafts: Drafts): boolean {
  const draft = drafts[item.id];
  return draft !== undefined && draft !== savedValue(item);
}

export function withoutDraft(drafts: Drafts, keyId: string): Drafts {
  if (!(keyId in drafts)) return drafts;
  const next = { ...drafts };
  delete next[keyId];
  return next;
}

/** The next untranslated/outdated key after `keyId`, wrapping around to the start. */
export function findNextOpenKey(list: EditorKeyItem[], keyId: string): EditorKeyItem | null {
  const index = list.findIndex((k) => k.id === keyId);
  if (index === -1) return null;
  const rotated = [...list.slice(index + 1), ...list.slice(0, index)];
  return rotated.find(isOpen) ?? null;
}
