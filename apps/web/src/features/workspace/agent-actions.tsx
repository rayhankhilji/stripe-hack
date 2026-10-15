"use client";

import type { FindingSummaryDTO } from "@ghost/shared";
import { DatabaseZap, Radar, ScanSearch } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Tooltip } from "../../components/ui/tooltip";
import { useAnalyzeFinding, useRunDetection, useRunIngest } from "../../lib/queries";
import { isAnalyzable } from "./derive";
import { MutationNotice } from "./mutation-notice";

type IngestRun = { status: "running" | "succeeded" | "partial" | "failed"; error: string | null };
type Props = { target: FindingSummaryDTO | null; busy: boolean };

/**
 * The three agent actions. Only one runs at a time: each workflow writes to the same audit stream, and
 * overlapping a sync with a hunt would make the stream (and the operator's mental model) interleave.
 */
export function AgentActions({ target, busy }: Props) {
  const ingest = useRunIngest();
  const detect = useRunDetection();
  const analyze = useAnalyzeFinding();
  const running = busy || ingest.isPending || detect.isPending || analyze.isPending;
  const canInvestigate = target !== null && isAnalyzable(target);
  const investigateHint = !target
    ? "Hunt for leaks first: there is no case to investigate yet."
    : canInvestigate
      ? `Verify evidence and eligibility for ${target.customerName}`
      : `${target.customerName} is already past investigation`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={running}
          loading={ingest.isPending}
          onClick={() => ingest.mutate({ source: "fixtures" })}
        >
          <DatabaseZap aria-hidden className="size-4" />
          {ingest.isPending ? "Syncing…" : "Sync company data"}
        </Button>
        <Button variant="secondary" size="sm" disabled={running} loading={detect.isPending} onClick={() => detect.mutate()}>
          <Radar aria-hidden className="size-4" />
          {detect.isPending ? "Hunting…" : "Hunt for leaks"}
        </Button>
        <Tooltip content={investigateHint}>
          <span>
            <Button
              variant="primary"
              size="sm"
              disabled={running || !canInvestigate}
              loading={analyze.isPending}
              // U0's analyze variables type is `{ id } & Record<string, never>`, which rejects `id`; the runtime shape is `{ id }`.
              onClick={() => target && analyze.mutate({ id: target.id } as Parameters<typeof analyze.mutate>[0])}
            >
              <ScanSearch aria-hidden className="size-4" />
              {analyze.isPending ? "Investigating…" : "Investigate"}
            </Button>
          </span>
        </Tooltip>
      </div>
      <MutationNotice
        results={[
          {
            key: "ingest",
            error: ingest.error,
            message: ingest.data ? ingestSummary(ingest.data) : null,
            warn: ingest.data ? ingest.data.status !== "succeeded" : false,
            onDismiss: ingest.reset,
          },
          {
            key: "detect",
            error: detect.error,
            message: detect.data
              ? `Hunt complete: ${detect.data.created} new, ${detect.data.updated} updated, ${detect.data.unchanged} unchanged.`
              : null,
            onDismiss: detect.reset,
          },
          {
            key: "analyze",
            error: analyze.error,
            message: analyze.data ? `Investigation finished: ${analyze.data.customerName} is ${analyze.data.status.replaceAll("_", " ")}.` : null,
            onDismiss: analyze.reset,
          },
        ]}
      />
    </div>
  );
}

function ingestSummary(run: IngestRun): string {
  if (run.status === "succeeded") return "Sync complete. Every system is up to date.";
  if (run.status === "partial") return `Sync partially complete${run.error ? `: ${run.error}` : "."}`;
  if (run.status === "failed") return `Sync failed${run.error ? `: ${run.error}` : "."}`;
  return "Sync started.";
}
