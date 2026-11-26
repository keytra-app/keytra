"use client";

import { type ReactNode, useEffect, useId } from "react";
import { XIcon } from "./icons";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[calc(100dvh-2rem)] w-full overflow-y-auto ${maxWidth} rounded-lg border border-zinc-800 bg-[#111113] p-5`}
      >
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <h2 id={titleId} className="text-sm font-semibold text-zinc-100">
              {title}
            </h2>
            {description && <p className="text-xs text-zinc-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200 cursor-pointer"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Right-aligned button row at the bottom of a modal. */
export function ModalActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-4">
      {children}
    </div>
  );
}
