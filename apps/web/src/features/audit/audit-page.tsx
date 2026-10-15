"use client";

import { useMemo, useState } from "react";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { Skeleton } from "../../components/ui/skeleton";
import { PageHeader } from "../../components/ghost/page-header";
import { cn } from "../../lib/cn";
import { useAudit } from "../../lib/queries/audit";
import { AuditRow } from "./audit-row";
import { KIND_META, KIND_ORDER, countByKind, filterByKinds, type AuditKindValue } from "./audit-kinds";

export function AuditPage() {
  const query = useAudit({});
  const [selected, setSelected] = useState<ReadonlySet<AuditKindValue>>(new Set());
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const counts = useMemo(() => countByKind(items), [items]);
  const visible = useMemo(() => filterByKinds(items, selected), [items, selected]);

  const toggle = (k: AuditKindValue) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Audit" description="Every recommendation, approval, action and verified outcome, in order." />
      <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-2">
        {KIND_ORDER.map((k) => {
          const active = selected.has(k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(k)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-signal",
                active ? "border-forest bg-forest text-porcelain" : "border-line bg-white text-ink hover:bg-porcelain",
              )}
            >
              {KIND_META[k].label} <span className="tabular-nums opacity-70">{counts[k]}</span>
            </button>
          );
        })}
        {selected.size > 0 ? (
          <button type="button" onClick={() => setSelected(new Set())} className="px-2 text-xs text-ink/70 underline">
            Clear
          </button>
        ) : null}
      </div>
      <Card className="overflow-hidden p-0">
        {query.isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading audit trail">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No audit events yet" description="Events appear as soon as Ghost syncs data, detects revenue or takes an action." />
        ) : visible.length === 0 ? (
          <EmptyState title="No events match these filters" description="Clear a filter to see the full ledger." />
        ) : (
          <ul>
            {visible.map((e) => (
              <AuditRow key={e.id} event={e} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
