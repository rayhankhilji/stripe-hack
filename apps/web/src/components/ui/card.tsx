import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type CardProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  /** Optional header title (Geist semibold). */
  title?: ReactNode;
  /** Muted line under the title. */
  description?: ReactNode;
  /** Right-aligned header slot, e.g. a Button or link. */
  action?: ReactNode;
  /** Remove body padding (for edge-to-edge tables). */
  flush?: boolean;
  /** Lifts on hover; use when the whole card is a link target. */
  interactive?: boolean;
};

/** White content card · 16px radius · 1px soft border. */
export function Card({ title, description, action, flush, interactive, className, children, ...props }: CardProps) {
  const hasHeader = title !== undefined || description !== undefined || action !== undefined;
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface text-fg",
        interactive && "transition-[box-shadow,border-color,transform] duration-220 ease-ghost hover:-translate-y-px hover:border-border-strong hover:shadow-lift",
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <div className={cn("flex items-start justify-between gap-4 px-5 pt-4", flush ? "pb-4" : "pb-1")}>
          <div className="min-w-0">
            {title !== undefined ? <h3 className="text-sm font-semibold tracking-tight text-fg">{title}</h3> : null}
            {description !== undefined ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
          </div>
          {action !== undefined ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn(!flush && "p-5", !flush && hasHeader && "pt-3")}>{children}</div>
    </div>
  );
}
