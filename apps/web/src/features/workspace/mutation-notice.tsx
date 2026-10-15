"use client";

import { AppError } from "@ghost/shared";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "../../lib/cn";

export type MutationResult = {
  key: string;
  error: Error | null;
  message: string | null;
  warn?: boolean;
  onDismiss: () => void;
};

function errorText(err: Error): string {
  if (err instanceof AppError) return `${err.message} (${err.code})`;
  return err.message;
}

/** One-line outcome of the last agent action, on the forest panel. Errors stay until dismissed. */
export function MutationNotice({ results }: { results: MutationResult[] }) {
  const reduce = useReducedMotion();
  const shown = results.filter((r) => r.error || r.message);
  return (
    <div aria-live="polite" className="min-h-0">
      <AnimatePresence initial={false}>
        {shown.map((r) => {
          const failed = r.error !== null || r.warn === true;
          const Icon = failed ? CircleAlert : CircleCheck;
          return (
            <motion.div
              key={r.key}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              role={r.error ? "alert" : "status"}
              className={cn(
                "mt-1 flex items-start gap-2 rounded-control px-3 py-2 text-sm",
                failed ? "bg-punch/20 text-petal" : "bg-lime/15 text-lime",
              )}
            >
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1">{r.error ? errorText(r.error) : r.message}</span>
              <button
                type="button"
                onClick={r.onDismiss}
                className="rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-petal"
                aria-label="Dismiss"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
