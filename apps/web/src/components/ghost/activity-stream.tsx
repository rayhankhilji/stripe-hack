"use client";

import type { AuditEventDTO } from "@ghost/shared";
import { Bot, CreditCard, Server, UserRound, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import { formatTime } from "../../lib/format/date";
import { DURATION, EASE_GHOST } from "../ui/motion";
import { MonoId } from "./mono-id";

type Kind = AuditEventDTO["kind"];

const NODE: Record<Kind, string> = {
  info: "bg-fg-subtle",
  recommendation: "bg-punch dark:bg-petal",
  approval_pending: "bg-lemon",
  approval_decision: "bg-signal",
  action_executed: "bg-signal",
  outcome_verified: "bg-lime",
  error: "bg-punch",
};

const KIND_LABEL: Partial<Record<Kind, string>> = {
  recommendation: "Recommendation",
  approval_pending: "Awaiting approval",
  approval_decision: "Decision",
  action_executed: "Executed",
  outcome_verified: "Verified",
  error: "Error",
};

const ACTOR: Record<AuditEventDTO["actorType"], LucideIcon> = {
  agent: Bot,
  operator: UserRound,
  system: Server,
  stripe: CreditCard,
};

export type ActivityStreamProps = {
  events: AuditEventDTO[];
  /** Show at most N most recent events. */
  limit?: number;
  /** Tighter rows for side panels. */
  compact?: boolean;
  /** Rendered when `events` is empty. */
  emptyLabel?: string;
  className?: string;
};

/**
 * The agent's live activity = the audit feed. Newest first. New events fade in (y 6px, 220ms)
 * and their node pulses once; existing events never re-animate.
 */
export function ActivityStream({
  events,
  limit,
  compact,
  emptyLabel = "No activity yet.",
  className,
}: ActivityStreamProps) {
  const reduced = useReducedMotion();
  const sorted = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const shown = limit ? sorted.slice(0, limit) : sorted;

  // Ids present on first paint are not "new": only later arrivals animate.
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(shown.map((e) => e.id));
  const fresh = new Set(shown.filter((e) => !seen.current?.has(e.id)).map((e) => e.id));
  useEffect(() => {
    for (const e of shown) seen.current?.add(e.id);
  });

  if (shown.length === 0) {
    return <p className={cn("py-6 text-center text-sm text-fg-subtle", className)}>{emptyLabel}</p>;
  }

  return (
    <ol className={cn("relative", className)} aria-live="polite">
      <AnimatePresence initial={false}>
        {shown.map((e, i) => {
          const Actor = ACTOR[e.actorType];
          const isFresh = fresh.has(e.id);
          const kindLabel = KIND_LABEL[e.kind];
          return (
            <motion.li
              key={e.id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: DURATION.base, ease: EASE_GHOST }}
              className={cn("relative flex gap-3", compact ? "pb-3" : "pb-4", "last:pb-0")}
            >
              {i < shown.length - 1 ? (
                <span aria-hidden className="absolute left-1.5 top-4 -bottom-0.5 w-px bg-border" />
              ) : null}
              <span aria-hidden className="relative mt-1.5 grid size-3 shrink-0 place-items-center">
                {isFresh && !reduced ? (
                  <motion.span
                    className={cn("absolute inset-0 rounded-full", NODE[e.kind])}
                    initial={{ scale: 1, opacity: 0.55 }}
                    animate={{ scale: 2.8, opacity: 0 }}
                    transition={{ duration: 0.9, ease: EASE_GHOST }}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative size-2.5 rounded-full ring-4 ring-surface",
                    NODE[e.kind],
                    i === 0 && "size-3",
                  )}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p
                    className={cn("min-w-0 flex-1 text-fg", compact ? "text-xs" : "text-sm", i === 0 && "font-medium")}
                  >
                    {e.summary}
                  </p>
                  <time dateTime={e.occurredAt} className="shrink-0 font-mono text-2xs tabular-nums text-fg-subtle">
                    {formatTime(e.occurredAt)}
                  </time>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-fg-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Actor className="size-3" aria-hidden />
                    {e.actor}
                  </span>
                  {kindLabel ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{kindLabel}</span>
                    </>
                  ) : null}
                  {e.externalRef && !compact ? (
                    <MonoId value={e.externalRef} truncate={22} className="py-0 text-2xs" />
                  ) : null}
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
