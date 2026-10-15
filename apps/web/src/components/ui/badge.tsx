import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium leading-none [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-fg-muted ring-1 ring-inset ring-border",
        muted: "bg-transparent text-fg-subtle ring-1 ring-inset ring-border",
        petal: "bg-petal-soft text-punch-deep dark:bg-petal/15 dark:text-petal",
        punch: "bg-punch/10 text-punch ring-1 ring-inset ring-punch/20 dark:bg-punch/25 dark:text-petal",
        signal: "bg-signal-soft text-navy dark:bg-signal/20 dark:text-signal-soft",
        lemon: "bg-lemon-soft text-lemon-deep ring-1 ring-inset ring-lemon/60 dark:bg-lemon/20 dark:text-lemon",
        lime: "bg-lime-soft text-lime-deep dark:bg-lime/20 dark:text-lime",
        forest: "bg-forest text-petal",
        solid: "bg-fg text-canvas",
      },
      size: {
        sm: "h-5 px-2 text-2xs",
        md: "h-6 px-2.5 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    /** Leading status dot in the badge's text colour. */
    dot?: boolean;
  };

export function Badge({ className, tone, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export { badgeVariants };
