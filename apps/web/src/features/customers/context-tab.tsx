"use client";

import { useState } from "react";
import type { SourceRef } from "@ghost/shared";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { Skeleton } from "../../components/ui/skeleton";
import { MonoId } from "../../components/ghost/mono-id";
import { SourceChip } from "../../components/ghost/source-chip";
import { useCustomerContext } from "../../lib/queries/customers";

export function ContextTab({ customerId, customerName, knownSources }: { customerId: string; customerName: string; knownSources: SourceRef[] }) {
  const defaultQuestion = `What should we know about ${customerName}'s commercial status?`;
  const [draft, setDraft] = useState(defaultQuestion);
  const [question, setQuestion] = useState(defaultQuestion);
  const query = useCustomerContext(customerId, question);
  const hits = query.data ?? [];

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setQuestion(draft.trim());
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Ask the knowledge graph</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal"
          />
        </label>
        <Button type="submit" variant="primary" size="md">
          Ask
        </Button>
      </form>
      {query.isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Searching knowledge">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : query.isError ? (
        <Card>
          <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
        </Card>
      ) : hits.length === 0 ? (
        <Card>
          <EmptyState title="No context found" description="The knowledge layer has nothing indexed for this question yet." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {hits.map((h, i) => (
            <li key={`${i}-${h.sourceExternalIds.join(",")}`}>
              <Card className="space-y-3">
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{h.text}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {h.sourceExternalIds.map((id) => {
                    // The knowledge layer returns bare ids; only link ones we can resolve to a known source.
                    const s = knownSources.find((k) => k.externalId === id);
                    return s ? <SourceChip key={id} system={s.system} externalId={id} title={s.title} /> : <MonoId key={id} value={id} />;
                  })}
                  <span className="ml-auto rounded-full bg-porcelain px-2 py-0.5 text-xs text-ink/70">
                    {h.via === "cognee" ? "via Cognee knowledge graph" : "via full-text fallback"}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
