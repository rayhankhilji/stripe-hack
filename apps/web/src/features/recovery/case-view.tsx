"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppError } from "@ghost/shared";
import { useFinding } from "../../lib/queries";
import { ActivityStream } from "../../components/ghost/activity-stream";
import { Skeleton } from "../../components/ui/skeleton";
import { ErrorState } from "../../components/ui/error-state";
import { cn } from "../../lib/cn";
import { ActionPanel } from "./action-panel";
import { CalculationSection } from "./calculation-section";
import { CaseHeader } from "./case-header";
import { EligibilitySection } from "./eligibility-section";
import { EvidenceSection } from "./evidence-section";
import { ExplanationSection } from "./explanation-section";
import { evidenceAnchor } from "./case-model";

type Tab = "case" | "timeline";

export function CaseView({ id }: { id: string }) {
  const finding = useFinding(id);
  const [tab, setTab] = useState<Tab>("case");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (clear.current) clearTimeout(clear.current);
  }, []);

  const cite = useCallback((evidenceId: string) => {
    setTab("case");
    setHighlighted(evidenceId);
    requestAnimationFrame(() => document.getElementById(evidenceAnchor(evidenceId))?.scrollIntoView({ behavior: "smooth", block: "center" }));
    if (clear.current) clearTimeout(clear.current);
    clear.current = setTimeout(() => setHighlighted(null), 1800);
  }, []);

  if (finding.isPending) return <CaseSkeleton />;
  if (finding.isError) {
    const notFound = finding.error instanceof AppError && finding.error.code === "NOT_FOUND";
    return (
      <div className="mx-auto w-full max-w-7xl px-8 py-8">
        <ErrorState
          title={notFound ? "Case not found" : "Couldn't load this case"}
          description={notFound ? "It may have been removed by a demo reset." : finding.error.message}
          onRetry={notFound ? undefined : () => void finding.refetch()}
        />
      </div>
    );
  }

  const f = finding.data;
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-8 py-8">
      <CaseHeader finding={f} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-8">
          <div role="tablist" aria-label="Case view" className="flex gap-1">
            {(["case", "timeline"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
                  tab === t ? "bg-forest text-porcelain" : "text-ink/70 hover:bg-white hover:text-ink",
                )}
              >
                {t === "case" ? "Case" : `Timeline · ${f.timeline.length}`}
              </button>
            ))}
          </div>
          {tab === "case" ? (
            <>
              <ExplanationSection finding={f} onCite={cite} />
              <CalculationSection finding={f} />
              <EvidenceSection finding={f} highlighted={highlighted} />
              <EligibilitySection finding={f} />
            </>
          ) : (
            <div className="rounded-3xl bg-white p-6">
              {f.timeline.length === 0 ? (
                <p className="text-sm text-ink/60">No audit events yet.</p>
              ) : (
                <ActivityStream events={[...f.timeline].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))} />
              )}
            </div>
          )}
        </div>
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-6">
            <ActionPanel finding={f} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function CaseSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-8 py-8" aria-busy="true" aria-label="Loading case">
      <Skeleton className="h-4 w-32" />
      <div className="flex justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <Skeleton className="h-64 w-full lg:col-span-4" />
      </div>
    </div>
  );
}
