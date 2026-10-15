"use client";

import type { LucideIcon } from "lucide-react";
import { Money } from "../../components/ghost/money";
import { cn } from "../../lib/cn";

export type KpiAccent = "lemon" | "signal" | "lime";

const ACCENT: Record<KpiAccent, { tile: string; bar: string }> = {
  lemon: { tile: "bg-lemon text-forest", bar: "bg-lemon" },
  signal: { tile: "bg-signal text-white", bar: "bg-signal" },
  lime: { tile: "bg-lime text-forest", bar: "bg-lime" },
};

type Props = {
  label: string;
  cents: number;
  hint: string;
  accent: KpiAccent;
  icon: LucideIcon;
};

/** One compact KPI: two-tone glyph tile, label, and a figure that counts up when the real value changes. */
export function KpiTile({ label, cents, hint, accent, icon: Icon }: Props) {
  const tone = ACCENT[accent];
  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-surface p-4 shadow-soft">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-0.5", tone.bar)} />
      <div className="flex items-center gap-3">
        <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-control", tone.tile)}>
          <Icon className="size-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-fg-muted">{label}</p>
          <p className="truncate text-xs text-fg-subtle">{hint}</p>
        </div>
        <div aria-live="polite">
          <Money cents={cents} size="lg" animate />
        </div>
      </div>
    </div>
  );
}
