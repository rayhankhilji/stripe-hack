import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Small label above the title (e.g. breadcrumb or section name). */
  eyebrow?: ReactNode;
  /** Right-aligned actions (Buttons). */
  actions?: ReactNode;
  /** Extra row under the title (badges, identity chips, tabs). */
  children?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, eyebrow, actions, children, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-8 flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">{eyebrow}</div> : null}
          <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">{title}</h1>
          {description ? <p className="mt-1.5 max-w-2xl text-sm text-fg-muted md:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
