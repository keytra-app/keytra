import type { ReactNode } from "react";

type BadgeVariant = "neutral" | "success" | "warning" | "danger";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "border-zinc-800 bg-zinc-900/80 text-zinc-300",
  success: "border-emerald-900/70 bg-emerald-950/50 text-emerald-400",
  warning: "border-amber-900/70 bg-amber-950/50 text-amber-400",
  danger: "border-red-900/70 bg-red-950/50 text-red-400",
};

export function Badge({
  children,
  variant = "neutral",
  mono = false,
  className = "",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-none font-medium ${VARIANTS[variant]} ${mono ? "font-mono" : ""} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
