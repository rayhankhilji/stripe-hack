"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { DURATION, EASE_GHOST } from "../ui/motion";

export type AgentStepState = "pending" | "active" | "done" | "error";

export type AgentStepProps = {
  state: AgentStepState;
  title: ReactNode;
  detail?: ReactNode;
  /** Right-aligned mono timestamp or duration. */
  meta?: ReactNode;
  /** Hide the connector trail below the node (last step). */
  last?: boolean;
  className?: string;
};

/** One node of an agent workflow (e.g. analyze-finding steps), connected by a revenue trail. */
export function AgentStep({ state, title, detail, meta, last, className }: AgentStepProps) {
  const reduced = useReducedMotion();
  return (
    <motion.li
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_GHOST }}
      className={cn("relative flex gap-3 pb-4 last:pb-0", className)}
    >
      {last ? null : (
        <span
          aria-hidden
          className={cn("absolute left-2.5 top-6 -bottom-0 w-px", state === "done" ? "bg-punch/40 dark:bg-petal/50" : "bg-border")}
        />
      )}
      <span
        aria-hidden
        className={cn(
          "relative z-10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-220",
          state === "pending" && "border border-border-strong bg-surface",
          state === "active" && "bg-petal text-forest shadow-ring",
          state === "done" && "bg-punch text-white dark:bg-petal dark:text-forest",
          state === "error" && "bg-punch text-white",
        )}
      >
        {state === "active" ? <LoaderCircle className="size-3 motion-safe:animate-spin" strokeWidth={3} /> : null}
        {state === "done" ? <Check className="size-3" strokeWidth={3} /> : null}
        {state === "error" ? <X className="size-3" strokeWidth={3} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className={cn("text-sm font-medium", state === "pending" ? "text-fg-subtle" : "text-fg")}>
            <span className="sr-only">{state}: </span>
            {title}
          </p>
          {meta ? <span className="shrink-0 font-mono text-2xs text-fg-subtle">{meta}</span> : null}
        </div>
        {detail ? <div className="mt-0.5 text-xs leading-relaxed text-fg-muted">{detail}</div> : null}
      </div>
    </motion.li>
  );
}
