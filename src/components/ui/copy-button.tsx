"use client";

import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { CheckIcon, CopyIcon } from "./icons";
import { useToast } from "./toast";

/** Copies to the clipboard; `copied` stays true for `resetMs` as visual feedback. */
export function useCopyToClipboard(resetMs: number) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function copy(value: string, toastMessage?: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (toastMessage) toast(toastMessage);
      window.setTimeout(() => setCopied(false), resetMs);
    } catch {
      toast("Kopieren fehlgeschlagen.", "error");
    }
  }

  return { copied, copy };
}

export function CopyButton({
  value,
  label = "Kopieren",
  copiedLabel = "Kopiert",
  toastMessage,
  variant = "secondary",
  size = "xs",
  className = "",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  toastMessage?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { copied, copy } = useCopyToClipboard(1800);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => copy(value, toastMessage)}
      className={className}
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
      <span>{copied ? copiedLabel : label}</span>
    </Button>
  );
}
