"use client";

import { useState, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CopyButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  value: string;
  label?: string;
  copiedLabel?: string;
}

export function CopyButton({
  value,
  label = "Copiar",
  copiedLabel = "Copiado",
  className,
  type = "button",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard indisponível (ex.: contexto não seguro): falha silenciosa.
    }
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-input border border-verity-border bg-white px-2.5 py-1 text-xs font-medium text-verity-ink-muted transition-colors hover:bg-verity-bg",
        className,
      )}
      aria-live="polite"
      {...props}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
