"use client";

import type { LucideIcon } from "lucide-react";
import { Money } from "../../components/ghost/money";
import { cn } from "../../lib/cn";
import { useCountUp } from "./use-count-up";

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
  const shown = useCountUp(cents);
  const tone = ACCENT[accent];
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-white p-4 shadow-soft">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", tone.bar)} />
      <div className="flex items-center gap-2">
        <span aria-hidden className={cn("grid size-6 place-items-center rounded-control", tone.tile)}>
          <Icon className="size-3.5" strokeWidth={2.25} />
        </span>
        <span className="text-xs font-medium text-ink/70">{label}</span>
      </div>
      <div className="mt-3" aria-live="polite">
        <Money cents={shown} size="lg" />
      </div>
      <p className="mt-1 truncate text-xs text-ink/55">{hint}</p>
    </div>
  );
}
