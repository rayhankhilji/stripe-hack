import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** Convenience: render N stacked text lines instead of one block. */
  lines?: number;
};

/** Loading placeholder with a soft shimmer (static under reduced motion). Size it with className. */
export function Skeleton({ className, lines, ...props }: SkeletonProps) {
  const block =
    "rounded-control bg-surface-muted bg-[linear-gradient(90deg,transparent_0%,var(--color-surface)_50%,transparent_100%)] bg-size-[200%_100%] motion-safe:animate-shimmer";
  if (lines && lines > 1) {
    return (
      <div aria-hidden className={cn("flex flex-col gap-2", className)} {...props}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cn(block, "h-3.5", i === lines - 1 && "w-2/3")} />
        ))}
      </div>
    );
  }
  return <div aria-hidden className={cn(block, "h-4", className)} {...props} />;
}
