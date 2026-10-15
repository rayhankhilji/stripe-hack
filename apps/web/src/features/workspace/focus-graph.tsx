"use client";

import type { FindingSummaryDTO } from "@ghost/shared";
import { EvidenceGraph } from "../../components/ghost/evidence-graph";
import { Skeleton } from "../../components/ui/skeleton";
import { useFinding } from "../../lib/queries";

/** Evidence graph for the case Ghost is focused on. Sources light up as their records are part of the evidence. */
export function FocusGraph({ finding }: { finding: FindingSummaryDTO | null }) {
  if (!finding) {
    return (
      <p className="text-sm text-porcelain/60">
        When Ghost finds a case, its customer appears here with every source system that backs it.
      </p>
    );
  }
  return <FindingGraph id={finding.id} customerName={finding.customerName} />;
}

function FindingGraph({ id, customerName }: { id: string; customerName: string }) {
  const detail = useFinding(id);
  if (detail.isPending) return <Skeleton className="aspect-square w-full rounded-card bg-forest-2" />;
  if (detail.isError) {
    return (
      <div className="text-sm text-petal">
        Could not load the evidence for {customerName}.{" "}
        <button type="button" className="underline underline-offset-2" onClick={() => void detail.refetch()}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <div>
      <EvidenceGraph customerName={detail.data.customerName} evidence={detail.data.evidence} />
      <p className="mt-2 text-xs text-porcelain/60">
        {detail.data.evidence.filter((e) => e.verified).length} of {detail.data.evidence.length} quotes verified verbatim
        against source records.
      </p>
    </div>
  );
}
