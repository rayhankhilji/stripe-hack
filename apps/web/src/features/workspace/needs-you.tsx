"use client";

import type { OverviewDTO } from "@ghost/shared";
import { AlertTriangle, CircleCheck, Clock, CreditCard, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "../../lib/cn";
import { NEEDS_LABEL } from "./copy";
import { SectionCard } from "./section-card";

type Item = OverviewDTO["needsAttention"][number];

const TONE: Record<Item["kind"], { icon: LucideIcon; tile: string }> = {
  needs_review: { icon: AlertTriangle, tile: "bg-lemon/40 text-fg" },
  escalated: { icon: ShieldAlert, tile: "bg-punch text-white" },
  payment_failed: { icon: CreditCard, tile: "bg-punch/15 text-punch" },
  overdue: { icon: Clock, tile: "bg-signal/15 text-navy" },
};

export function NeedsYou({ items }: { items: OverviewDTO["needsAttention"] }) {
  return (
    <SectionCard
      title="Needs you"
      action={
        items.length > 0 ? (
          <span className="rounded-full bg-punch px-2 py-0.5 text-xs font-semibold tabular-nums text-white">{items.length}</span>
        ) : null
      }
    >
      {items.length === 0 ? (
        <div className="flex items-center gap-2 px-4 pb-4 text-sm text-fg-muted">
          <CircleCheck aria-hidden className="size-4 text-forest-2" />
          Nothing is waiting on you.
        </div>
      ) : (
        <ul className="space-y-1 px-2 pb-2">
          {items.map((item) => {
            const tone = TONE[item.kind];
            const Icon = tone.icon;
            return (
              <li key={`${item.kind}:${item.href}`}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
                >
                  <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-control", tone.tile)}>
                    <Icon className="size-3.5" strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{item.title}</span>
                    <span className="block text-xs text-fg-subtle">{NEEDS_LABEL[item.kind]}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
