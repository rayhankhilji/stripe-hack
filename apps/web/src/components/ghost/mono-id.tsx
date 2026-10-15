"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/cn";

export type MonoIdProps = {
  /** The identifier, e.g. "deal-127", "in_1Q…", "evt_…". */
  value: string;
  /** Keep the first N characters and an ellipsis (full value in title). */
  truncate?: number;
  /** Show a copy button on hover. Default true. */
  copyable?: boolean;
  /** Optional system/kind prefix rendered muted, e.g. "salesforce". */
  prefix?: string;
  className?: string;
};

/** Technical identifier in Geist Mono on a quiet chip. */
export function MonoId({ value, truncate, copyable = true, prefix, className }: MonoIdProps) {
  const [copied, setCopied] = useState(false);
  const text = truncate && value.length > truncate ? `${value.slice(0, truncate)}…` : value;

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <span
      title={value}
      className={cn(
        "group/id inline-flex max-w-full items-center gap-1 rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-fg-muted ring-1 ring-inset ring-border",
        className,
      )}
    >
      {prefix ? <span className="text-fg-subtle">{prefix}:</span> : null}
      <span className="truncate">{text}</span>
      {copyable ? (
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Copied" : `Copy ${value}`}
          className="-mr-0.5 grid size-4 shrink-0 place-items-center rounded text-fg-subtle opacity-0 transition-opacity duration-180 hover:text-fg focus-visible:opacity-100 group-hover/id:opacity-100"
        >
          {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
        </button>
      ) : null}
    </span>
  );
}
