"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { formatMoney, formatMoneyCompact, formatMoneyShort } from "../../lib/format/money";

export type MoneyProps = {
  /** Integer cents from the API. Never derived on the client. */
  cents: number;
  currency?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "display";
  /** "short" drops .00 on whole amounts (default), "full" always shows cents, "compact" → $72.2K. */
  format?: "short" | "full" | "compact";
  /** Count up from the previous value when `cents` changes (and from 0 on mount). Reduced motion: instant. */
  animate?: boolean;
  tone?: "default" | "muted" | "lime" | "lemon" | "petal" | "punch";
  className?: string;
};

const SIZE: Record<NonNullable<MoneyProps["size"]>, string> = {
  xs: "text-xs font-medium",
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-2xl font-semibold tracking-tight",
  xl: "text-4xl font-semibold tracking-tight",
  display: "text-5xl md:text-6xl font-semibold tracking-tighter",
};

const TONE: Record<NonNullable<MoneyProps["tone"]>, string> = {
  default: "",
  muted: "text-fg-muted",
  lime: "text-lime-deep dark:text-lime",
  lemon: "text-lemon-deep dark:text-lemon",
  petal: "text-punch dark:text-petal",
  punch: "text-punch",
};

function render(cents: number, currency: string, format: NonNullable<MoneyProps["format"]>): string {
  if (format === "full") return formatMoney(cents, currency);
  if (format === "compact") return formatMoneyCompact(cents, currency);
  return formatMoneyShort(cents, currency);
}

/** Tabular money figure. The animation interpolates display only; the final text is always the exact `cents`. */
export function Money({
  cents,
  currency = "usd",
  size = "sm",
  format = "short",
  animate: shouldAnimate,
  tone = "default",
  className,
}: MoneyProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(shouldAnimate && !reduced ? 0 : cents);
  const from = useRef(shouldAnimate && !reduced ? 0 : cents);

  useEffect(() => {
    if (!shouldAnimate || reduced) {
      setShown(cents);
      from.current = cents;
      return;
    }
    const controls = animate(from.current, cents, {
      duration: 0.9,
      ease: [0.2, 0, 0, 1],
      onUpdate: (v) => setShown(Math.round(v)),
      onComplete: () => setShown(cents),
    });
    from.current = cents;
    return () => controls.stop();
  }, [cents, shouldAnimate, reduced]);

  return (
    <span
      className={cn("whitespace-nowrap font-sans tabular-nums", SIZE[size], TONE[tone], className)}
      aria-label={render(cents, currency, "full")}
    >
      {render(shown, currency, format)}
    </span>
  );
}
