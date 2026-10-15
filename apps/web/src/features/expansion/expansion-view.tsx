"use client";

import { Radar } from "lucide-react";
import { useExpansion, useScanExpansion } from "../../lib/queries/expansion";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { Skeleton } from "../../components/ui/skeleton";
import { PageHeader } from "../../components/ghost/page-header";
import { ExpansionCard } from "./expansion-card";

export function ExpansionView() {
  const expansion = useExpansion();
  const scan = useScanExpansion();

  const action = (
    <Button variant="primary" onClick={() => scan.mutate()} disabled={scan.isPending}>
      <Radar aria-hidden className="size-4" />
      {scan.isPending ? "Scanning…" : "Scan for growth"}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6 p-8">
      <PageHeader
        title="Growth"
        description="Active customers with no open deal, heavy feature demand and a recent expansion conversation. Every opportunity cites its source records."
        actions={action}
      />

      {scan.isError && <ErrorState title="Scan failed" message={scan.error.message} onRetry={() => scan.mutate()} />}
      {scan.data && (
        <p role="status" className="rounded-lg bg-lime/40 px-4 py-3 text-sm text-ink">
          Scan complete: {scan.data.created} new opportunit{scan.data.created === 1 ? "y" : "ies"}.
        </p>
      )}

      {expansion.isLoading && (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      )}
      {expansion.isError && (
        <ErrorState title="Could not load growth opportunities" message={expansion.error.message} onRetry={() => void expansion.refetch()} />
      )}
      {expansion.data && expansion.data.length === 0 && (
        <EmptyState
          title="No expansion signals yet"
          description="Run a scan. A customer qualifies when it is active, has no open deals, 10 or more feature requests and an expansion conversation on record."
        />
      )}
      {expansion.data && expansion.data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {expansion.data.map((item) => (
            <ExpansionCard key={item.id} item={item} onScan={() => scan.mutate()} scanning={scan.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}
