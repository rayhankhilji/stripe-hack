import type { EligibilityCheckDTO } from "@ghost/shared";
import { Check, Minus, X } from "lucide-react";
import { cn } from "../../lib/cn";

export type RuleRowProps = {
  check: EligibilityCheckDTO;
  className?: string;
};

const OUTCOME = {
  pass: { icon: Check, tile: "bg-lime text-forest", label: "Pass", text: "text-lime-deep dark:text-lime" },
  warn: { icon: Minus, tile: "bg-lemon text-forest", label: "Warn", text: "text-lemon-deep dark:text-lemon" },
  fail: { icon: X, tile: "bg-punch text-white", label: "Fail", text: "text-punch dark:text-petal" },
} as const;

/** One eligibility rule (R-01..R-10) with its deterministic outcome and detail. */
export function RuleRow({ check, className }: RuleRowProps) {
  const o = OUTCOME[check.outcome];
  const Icon = o.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-control px-3 py-2.5 transition-colors duration-180",
        check.outcome === "warn" && "bg-lemon-soft/60 dark:bg-lemon/10",
        check.outcome === "fail" && "bg-punch/5 dark:bg-punch/15",
        className,
      )}
    >
      <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md", o.tile)}>
        <Icon className="size-3.5" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-2xs text-fg-subtle">{check.ruleId}</span>
          <span className="text-sm font-medium text-fg">{check.name}</span>
          <span className={cn("ml-auto text-2xs font-semibold uppercase tracking-wider", o.text)}>
            <span className="sr-only">Outcome: </span>
            {o.label}
          </span>
        </div>
        {check.detail ? <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{check.detail}</p> : null}
      </div>
    </div>
  );
}
