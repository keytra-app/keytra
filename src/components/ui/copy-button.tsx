"use client";

import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { CheckIcon, CopyIcon } from "./icons";
import { useToast } from "./toast";

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
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (toastMessage) toast(toastMessage);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Kopieren fehlgeschlagen.", "error");
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleCopy} className={className}>
      {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5" />}
      <span>{copied ? copiedLabel : label}</span>
    </Button>
  );
}
