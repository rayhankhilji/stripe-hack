"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "../../components/ui/error-state";
import { keys, useActivity, useOverview } from "../../lib/queries";
import { AgentPanel } from "./agent-panel";
import { ConnectedSystems } from "./connected-systems";
import { derivePhase, focusFinding, isLive, newestEvent } from "./derive";
import { FirstRun } from "./first-run";
import { KpiTiles } from "./kpi-tiles";
import { NeedsYou } from "./needs-you";
import { TopOpportunities } from "./top-opportunities";
import { WorkspaceSkeleton } from "./workspace-skeleton";

/** Agent workspace (`/`): what Ghost is investigating, what it found, and what it needs from you. */
export function WorkspaceScreen() {
  const overview = useOverview();
  const activity = useActivity();
  const qc = useQueryClient();
  const now = useNow(2000);

  const events = useMemo(
    () => [...(activity.data?.items ?? [])].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
    [activity.data],
  );
  const newestId = newestEvent(events)?.id ?? null;

  // Every state change writes an audit event, so a new event means the overview (KPIs, cases) may have moved:
  // e.g. Stripe's invoice.paid webhook lands and the Recovered tile counts up without a reload.
  useEffect(() => {
    if (newestId) void qc.invalidateQueries({ queryKey: keys.overview });
  }, [newestId, qc]);

  if (overview.isPending) return <WorkspaceSkeleton />;
  if (overview.isError) {
    return (
      <div className="p-6 md:p-8">
        <ErrorState
          title="Ghost could not load the workspace"
          error={overview.error}
          onRetry={() => void overview.refetch()}
        />
      </div>
    );
  }

  const data = overview.data;
  const phase = derivePhase(data);

  if (phase.kind === "first_run") {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-8">
        <FirstRun events={events} />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 p-4 md:p-8 lg:grid-cols-12">
      <div className="lg:sticky lg:top-8 lg:col-span-8 lg:self-start">
        <AgentPanel
          phase={phase}
          focus={focusFinding(data.topFindings)}
          events={events}
          activityError={activity.isError}
          live={isLive(events, now)}
        />
      </div>
      <aside className="flex flex-col gap-5 lg:col-span-4" aria-label="Workspace summary">
        <KpiTiles overview={data} />
        <TopOpportunities findings={data.topFindings} />
        <NeedsYou items={data.needsAttention} />
        <ConnectedSystems overview={data} />
      </aside>
    </div>
  );
}

/** A coarse clock so "Working" turns into "Watching" once events stop arriving. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
