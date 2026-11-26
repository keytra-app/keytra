"use client";

import { useEffect } from "react";

/**
 * Global editor shortcuts: ⌘/Ctrl+K search, ⌘/Ctrl+Enter save, Alt+↑/↓ previous/next key.
 * Disabled while a modal is open; saving is skipped while the inline description is edited,
 * which handles ⌘/Ctrl+Enter itself.
 */
export function useEditorShortcuts({
  disabled,
  saveDisabled,
  onSearch,
  onSave,
  onStep,
}: {
  disabled: boolean;
  saveDisabled: boolean;
  onSearch: () => void;
  onSave: () => void;
  onStep: (delta: -1 | 1) => void;
}) {
  useEffect(() => {
    if (disabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const mod = (e.metaKey || e.ctrlKey) && !e.altKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onSearch();
        return;
      }

      if (mod && e.key === "Enter") {
        if (saveDisabled) return;
        e.preventDefault();
        onSave();
        return;
      }

      const plainAlt = e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey;
      if (!plainAlt || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      onStep(e.key === "ArrowUp" ? -1 : 1);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, saveDisabled, onSearch, onSave, onStep]);
}
