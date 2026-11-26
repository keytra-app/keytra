"use client";

import { useCallback, useRef, useState } from "react";
import type { KeyUpdate } from "@/components/keys/key-modals";
import { useToast } from "@/components/ui/toast";
import { saveTranslationAction } from "@/lib/editor/actions";
import type { EditorKeyItem, EditorPageData, SourceKey } from "@/lib/editor/queries";
import { type Drafts, sortKeys, withoutDraft } from "./key-status";

/** Client copy of the project's keys, unsaved drafts and optimistic translation saves. */
export function useEditorKeys(data: EditorPageData) {
  const { toast } = useToast();
  const [keys, setKeys] = useState(data.keys);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [pendingSaves, setPendingSaves] = useState(0);
  // Latest save per key; responses of older, overtaken saves are ignored.
  const saveSeqRef = useRef(new Map<string, number>());

  const patchKey = useCallback((keyId: string, patch: (item: EditorKeyItem) => EditorKeyItem) => {
    setKeys((prev) => prev.map((k) => (k.id === keyId ? patch(k) : k)));
  }, []);

  const setDraft = useCallback((keyId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [keyId]: value }));
  }, []);

  const discardDraft = useCallback((keyId: string) => {
    setDrafts((prev) => withoutDraft(prev, keyId));
  }, []);

  /** Marks `value` as translated right away, persists it and rolls back if that fails. */
  const persistTranslation = useCallback(
    (item: EditorKeyItem, value: string) => {
      const keyId = item.id;
      const previous = item.translation;
      const seq = (saveSeqRef.current.get(keyId) ?? 0) + 1;
      saveSeqRef.current.set(keyId, seq);
      const isLatest = () => saveSeqRef.current.get(keyId) === seq;

      function rollback(message: string) {
        patchKey(keyId, (k) => ({ ...k, translation: previous }));
        setDraft(keyId, value);
        toast(message, "error");
      }

      patchKey(keyId, (k) => ({
        ...k,
        translation: {
          value,
          status: "translated",
          updatedAt: new Date().toISOString(),
          updatedByName: data.user.name,
        },
      }));
      discardDraft(keyId);
      setPendingSaves((n) => n + 1);

      void saveTranslationAction({
        projectId: data.project.id,
        keyId,
        localeId: data.locale.id,
        value,
        sourceValue: item.sourceValue,
      })
        .then((res) => {
          if (!isLatest()) return;
          if (!res.ok) return rollback(res.error);
          patchKey(keyId, (k) =>
            k.translation
              ? {
                  ...k,
                  translation: {
                    ...k.translation,
                    updatedAt: res.updatedAt,
                    updatedByName: res.updatedByName,
                  },
                }
              : k,
          );
        })
        .catch(() => {
          if (isLatest()) rollback("Speichern fehlgeschlagen. Bitte erneut versuchen.");
        })
        .finally(() => setPendingSaves((n) => Math.max(0, n - 1)));
    },
    [data.user.name, data.project.id, data.locale.id, patchKey, setDraft, discardDraft, toast],
  );

  function addKey(created: SourceKey): EditorKeyItem {
    const item: EditorKeyItem = { ...created, translation: null, references: [] };
    setKeys((prev) => sortKeys([...prev, item]));
    return item;
  }

  function applyKeyUpdate({ keyId, sourceValue, description, sourceChanged }: KeyUpdate) {
    patchKey(keyId, (k) => ({
      ...k,
      sourceValue,
      description,
      translation:
        sourceChanged && k.translation?.status === "translated"
          ? { ...k.translation, status: "outdated" }
          : k.translation,
      references: sourceChanged ? [] : k.references,
    }));
  }

  function setDescription(keyId: string, description: string | null) {
    patchKey(keyId, (k) => ({ ...k, description }));
  }

  function removeKey(keyId: string) {
    setKeys((prev) => prev.filter((k) => k.id !== keyId));
    discardDraft(keyId);
  }

  return {
    keys,
    drafts,
    pendingSaves,
    setDraft,
    discardDraft,
    persistTranslation,
    addKey,
    applyKeyUpdate,
    setDescription,
    removeKey,
  };
}
