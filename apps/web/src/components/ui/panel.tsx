import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const panelVariants = cva("relative overflow-hidden rounded-panel", {
  variants: {
    tone: {
      /** White working surface on the porcelain canvas. */
      surface: "border border-border bg-surface text-fg",
      /** Quiet porcelain inset, for grouping inside a surface. */
      porcelain: "bg-surface-muted text-fg",
      /** The agent's surface: forest with porcelain text and petal accents. */
      forest: "dark bg-forest text-porcelain",
      /** Signature secondary combination: forest on petal. */
      petal: "bg-petal text-forest",
    },
    padding: {
      none: "",
      md: "p-5",
      lg: "p-6 md:p-7",
    },
  },
  defaultVariants: { tone: "surface", padding: "lg" },
});

export type PanelProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof panelVariants>;

/**
 * Large panel · 22px radius. `tone="forest"` also switches semantic tokens to dark,
 * so any primitive placed inside (Badge, Button, ActivityStream) renders correctly on forest.
 */
export function Panel({ tone, padding, className, ...props }: PanelProps) {
  return <section className={cn(panelVariants({ tone, padding }), className)} {...props} />;
}

export { panelVariants };
