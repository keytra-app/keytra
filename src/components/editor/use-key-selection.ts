"use client";

import { useCallback, useState } from "react";
import type { EditorKeyItem } from "@/lib/editor/queries";

/**
 * Selected key within the visible list. A selection that is filtered out falls back to the
 * first visible key. `onSelect` runs after an explicit selection or step.
 */
export function useKeySelection(
  visibleKeys: EditorKeyItem[],
  initialId: string | null,
  onSelect: () => void,
) {
  const [selectedKeyId, setSelectedKeyId] = useState(initialId);

  const selectedId =
    selectedKeyId && visibleKeys.some((k) => k.id === selectedKeyId)
      ? selectedKeyId
      : (visibleKeys[0]?.id ?? null);

  const selectKey = useCallback(
    (keyId: string) => {
      setSelectedKeyId(keyId);
      onSelect();
    },
    [onSelect],
  );

  const stepKey = useCallback(
    (delta: -1 | 1) => {
      if (visibleKeys.length === 0) return;
      const index = visibleKeys.findIndex((k) => k.id === selectedId);
      const next = index === -1 ? 0 : Math.max(0, Math.min(visibleKeys.length - 1, index + delta));
      const target = visibleKeys[next];
      if (target && target.id !== selectedId) selectKey(target.id);
    },
    [visibleKeys, selectedId, selectKey],
  );

  return { selectedId, setSelectedKeyId, selectKey, stepKey };
}
