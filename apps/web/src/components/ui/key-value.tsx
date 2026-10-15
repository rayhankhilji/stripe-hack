import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type KeyValueItem = { label: ReactNode; value: ReactNode; mono?: boolean; hint?: ReactNode };

export type KeyValueProps = {
  items: KeyValueItem[];
  /** "rows": label left, value right (side panels). "grid": stacked label/value tiles (headers). */
  layout?: "rows" | "grid";
  columns?: 2 | 3 | 4;
  className?: string;
};

/** Definition list for record facts. Values render "—" when null/undefined/empty. */
export function KeyValue({ items, layout = "rows", columns = 3, className }: KeyValueProps) {
  const show = (v: ReactNode) => (v === null || v === undefined || v === "" ? <span className="text-fg-subtle">—</span> : v);
  if (layout === "grid") {
    return (
      <dl
        className={cn(
          "grid gap-x-6 gap-y-4",
          columns === 2 && "grid-cols-2",
          columns === 3 && "grid-cols-2 sm:grid-cols-3",
          columns === 4 && "grid-cols-2 sm:grid-cols-4",
          className,
        )}
      >
        {items.map((item, i) => (
          <div key={i} className="min-w-0">
            <dt className="text-2xs font-medium uppercase tracking-wider text-fg-subtle">{item.label}</dt>
            <dd className={cn("mt-1 truncate text-sm text-fg", item.mono && "font-mono text-xs")}>{show(item.value)}</dd>
            {item.hint ? <dd className="mt-0.5 text-xs text-fg-subtle">{item.hint}</dd> : null}
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cn("divide-y divide-border", className)}>
      {items.map((item, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="shrink-0 text-sm text-fg-muted">{item.label}</dt>
          <dd className={cn("min-w-0 truncate text-right text-sm text-fg", item.mono && "font-mono text-xs")}>
            {show(item.value)}
            {item.hint ? <span className="block text-xs text-fg-subtle">{item.hint}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
