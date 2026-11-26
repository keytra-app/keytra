import type { ComponentPropsWithRef } from "react";

const FIELD_BASE =
  "w-full rounded-md border border-zinc-800 bg-[#09090b] text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50";

export function Input({
  className = "",
  mono = false,
  ...props
}: ComponentPropsWithRef<"input"> & { mono?: boolean }) {
  return (
    <input
      className={`${FIELD_BASE} h-9 px-3 ${mono ? "font-mono text-xs" : ""} ${className}`.trim()}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea className={`${FIELD_BASE} px-3 py-2 resize-y ${className}`.trim()} {...props} />;
}

export function Select({
  className = "",
  mono = false,
  ...props
}: ComponentPropsWithRef<"select"> & { mono?: boolean }) {
  return (
    <select
      className={`${FIELD_BASE} h-9 px-2.5 ${mono ? "font-mono text-xs" : ""} ${className}`.trim()}
      {...props}
    />
  );
}

export function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-xs font-medium text-zinc-400">
        {children}
      </label>
      {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
    </div>
  );
}
