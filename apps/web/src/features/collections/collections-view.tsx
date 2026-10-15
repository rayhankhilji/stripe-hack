"use client";

import { Play } from "lucide-react";
import { useCollections, useSweepCollections } from "../../lib/queries/collections";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { Skeleton } from "../../components/ui/skeleton";
import { PageHeader } from "../../components/ghost/page-header";
import { CollectionCard } from "./collection-card";

export function CollectionsView() {
  const collections = useCollections();
  const sweep = useSweepCollections();
  const result = sweep.data;

  const action = (
    <Button variant="primary" onClick={() => sweep.mutate()} disabled={sweep.isPending}>
      <Play aria-hidden className="size-4" />
      {sweep.isPending ? "Sweeping…" : "Run collections sweep"}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6 p-8">
      <PageHeader
        title="Collections"
        description="Every Ghost invoice as a visible sequence. Reminders are drafted for your approval and suppressed the moment Stripe confirms payment."
        actions={action}
      />

      {sweep.isError && (
        <ErrorState title="Sweep failed" message={sweep.error.message} onRetry={() => sweep.mutate()} />
      )}
      {result && (
        <p role="status" className="rounded-lg bg-lime/40 px-4 py-3 text-sm text-ink">
          Sweep complete: {result.drafted} drafted, {result.suppressed} suppressed, {result.escalated} escalated.
        </p>
      )}

      {collections.isLoading && (
        <div className="flex flex-col gap-4" aria-busy="true">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      )}
      {collections.isError && (
        <ErrorState title="Could not load collections" message={collections.error.message} onRetry={() => void collections.refetch()} />
      )}
      {collections.data && collections.data.length === 0 && (
        <EmptyState
          title="No invoices to collect yet"
          description="Approve a recovery case and Ghost will create the Stripe invoice and schedule its reminder sequence here."
        />
      )}
      {collections.data && collections.data.length > 0 && (
        <div className="flex flex-col gap-4">
          {collections.data.map((item) => (
            <CollectionCard key={item.invoice.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
