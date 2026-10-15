"use client";

import type { AuditEventDTO } from "@ghost/shared";
import { motion, useReducedMotion } from "motion/react";
import { formatRelative } from "../../lib/format/date";
import { cn } from "../../lib/cn";

/** "Working" while audit events are fresh, otherwise when Ghost last did something. The dot pulses once per start. */
export function LiveIndicator({ live, newest }: { live: boolean; newest: AuditEventDTO | null }) {
  const reduce = useReducedMotion();
  const label = live ? "Working" : newest ? `Watching · last step ${formatRelative(newest.occurredAt)}` : "Idle";
  return (
    <p className="flex items-center gap-1.5 text-xs text-porcelain/70" aria-live="polite">
      <span className="relative grid size-2 place-items-center" aria-hidden>
        {live && !reduce ? (
          <motion.span
            key={newest?.id ?? "live"}
            className="absolute inset-0 rounded-full bg-lime"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.6, opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
          />
        ) : null}
        <span className={cn("size-2 rounded-full", live ? "bg-lime" : "bg-porcelain/40")} />
      </span>
      {label}
    </p>
  );
}
