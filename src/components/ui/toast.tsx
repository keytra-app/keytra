"use client";

import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { XIcon } from "./icons";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };

type ToastContextValue = {
  toast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = nextId++;
      setItems((prev) => [...prev.slice(-3), { id, message, kind }]);
      window.setTimeout(() => dismiss(id), 3600);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-xs flex-col gap-2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-[#111113] px-3 py-2.5 text-xs text-zinc-200"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  item.kind === "error"
                    ? "bg-red-400"
                    : item.kind === "info"
                      ? "bg-zinc-400"
                      : "bg-emerald-400"
                }`}
              />
              <span className="truncate">{item.message}</span>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Hinweis schließen"
              className="shrink-0 text-zinc-500 hover:text-zinc-200 cursor-pointer"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
