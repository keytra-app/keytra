import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
export type ButtonSize = "xs" | "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-40 cursor-pointer";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border border-zinc-200 bg-zinc-100 text-zinc-950 hover:bg-white",
  secondary: "border border-zinc-800 bg-[#111113] text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100",
  ghost: "border border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
  danger: "border border-zinc-800 bg-[#111113] text-red-400 hover:border-red-900/80 hover:bg-red-950/40 hover:text-red-300",
  "danger-solid": "border border-red-800 bg-red-600/90 text-white hover:bg-red-600",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-xs",
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
};

export function buttonClasses({
  variant = "secondary",
  size = "sm",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();
}

export function Button({
  variant = "secondary",
  size = "sm",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
