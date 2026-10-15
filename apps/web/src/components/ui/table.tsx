import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/** Data table. Compose with TableHeader/TableBody/TableRow/TableHead/TableCell. Numeric cells: `numeric`. */
export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(function Table(
  { className, ...props },
  ref,
) {
  return (
    <div className="relative w-full overflow-x-auto scrollbar-quiet">
      <table ref={ref} className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props} />
    </div>
  );
});

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableHeader({ className, ...props }, ref) {
    return <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} />;
  },
);

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableBody({ className, ...props }, ref) {
    return <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
  },
);

export type TableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  /** Row is clickable: pointer cursor and hover tint. */
  interactive?: boolean;
  /** Highlight tone, e.g. lemon for Draft orders. */
  highlight?: "lemon" | "lime" | "petal";
};

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(function TableRow(
  { className, interactive, highlight, ...props },
  ref,
) {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border transition-colors duration-180 ease-ghost",
        interactive && "cursor-pointer hover:bg-surface-muted",
        highlight === "lemon" && "bg-lemon-soft/70 dark:bg-lemon/10",
        highlight === "lime" && "bg-lime-soft/70 dark:bg-lime/10",
        highlight === "petal" && "bg-petal-soft/60 dark:bg-petal/10",
        className,
      )}
      {...props}
    />
  );
});

export type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean };

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(function TableHead(
  { className, numeric, ...props },
  ref,
) {
  return (
    <th
      ref={ref}
      className={cn(
        "h-10 px-4 text-left align-middle text-2xs font-medium uppercase tracking-wider text-fg-subtle first:pl-5 last:pr-5",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
});

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean };

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(function TableCell(
  { className, numeric, ...props },
  ref,
) {
  return (
    <td
      ref={ref}
      className={cn(
        "px-4 py-3 align-middle text-fg first:pl-5 last:pr-5",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
});
