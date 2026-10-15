import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  /** A glyph (Lucide icon element) shown on a petal two-tone tile. */
  icon?: ReactNode;
  /** CTA, typically a Button. */
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md";
};

export function EmptyState({ title, description, icon, action, className, size = "md" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "md" ? "gap-3 px-6 py-14" : "gap-2 px-4 py-8",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden
          className={cn(
            "mb-1 grid place-items-center rounded-card bg-petal-soft text-punch dark:bg-petal/15 dark:text-petal",
            size === "md" ? "size-12 [&_svg]:size-5" : "size-9 [&_svg]:size-4",
          )}
        >
          {icon}
        </div>
      ) : null}
      <h3 className={cn("font-semibold tracking-tight text-fg", size === "md" ? "text-base" : "text-sm")}>{title}</h3>
      {description ? <p className="max-w-sm text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
