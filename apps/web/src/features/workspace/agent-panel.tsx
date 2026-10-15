"use client";

import type { AuditEventDTO, FindingSummaryDTO } from "@ghost/shared";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActivityStream } from "../../components/ghost/activity-stream";
import { Logo } from "../../components/ghost/logo";
import { cn } from "../../lib/cn";
import { AgentActions } from "./agent-actions";
import { briefFor } from "./agent-brief";
import { currentInvestigation, dedupeLead, newestEvent, type Phase } from "./derive";
import { FocusGraph } from "./focus-graph";
import { LiveIndicator } from "./live-indicator";

type Props = {
  phase: Phase;
  focus: FindingSummaryDTO | null;
  events: AuditEventDTO[];
  activityError: boolean;
  live: boolean;
};

type StreamMode = "case" | "all";

/** "Ghost is working": the forest panel that carries the agent's brief, its live activity and its evidence graph. */
export function AgentPanel({ phase, focus, events, activityError, live }: Props) {
  const brief = briefFor(phase);
  const [mode, setMode] = useState<StreamMode>("case");
  const stream = mode === "case" ? currentInvestigation(events, 14, focus?.id ?? null) : events.slice(0, 14);

  return (
    <section
      aria-labelledby="agent-headline"
      className="dark relative flex flex-col overflow-hidden rounded-panel bg-forest text-porcelain shadow-soft"
    >
      <header className="flex items-center justify-between gap-4 px-6 pt-6 md:px-8 md:pt-7">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-control bg-forest-2">
            <Logo variant="symbol" size={24} />
          </span>
          <div>
            <p className="text-sm font-semibold text-petal">Ghost</p>
            <LiveIndicator live={live} newest={newestEvent(events)} />
          </div>
        </div>
        <p className="hidden whitespace-nowrap font-mono text-xs uppercase tracking-widest text-petal/80 sm:block">{brief.eyebrow}</p>
      </header>

      <div className="px-6 pt-6 md:px-8">
        <h1
          id="agent-headline"
          className="max-w-2xl font-display text-2xl font-semibold sm:text-3xl leading-tight text-petal text-balance md:text-4xl"
        >
          {brief.headline}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-porcelain/70">{brief.detail}</p>
        {brief.href && brief.cta ? (
          <Link
            href={brief.href}
            className="group mt-4 inline-flex items-center gap-1.5 rounded-control bg-petal px-3.5 py-2 text-sm font-semibold text-forest transition-colors hover:bg-porcelain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petal"
          >
            {brief.cta}
            <ArrowRight aria-hidden className="size-4 transition-transform duration-fast group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid flex-1 grid-cols-1 gap-px border-t border-forest-2 bg-forest-2 md:grid-cols-2">
        <div className="flex min-h-0 flex-col bg-forest px-6 py-5 md:px-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-porcelain/60">
              {mode === "case" ? "Current investigation" : "All activity"}
            </h2>
            <StreamToggle mode={mode} onChange={setMode} />
          </div>
          {activityError ? (
            <p className="text-sm text-petal">The activity feed is unreachable. Retrying every few seconds.</p>
          ) : stream.length === 0 ? (
            <p className="text-sm text-porcelain/60">
              No activity yet. Every step Ghost takes is written to the audit trail and appears here.
            </p>
          ) : (
            <div className="-mx-2 max-h-96 overflow-y-auto px-2">
              <ActivityStream events={stream.map((e) => ({ ...e, summary: dedupeLead(e.summary) }))} />
            </div>
          )}
        </div>
        <div className="flex flex-col bg-forest px-6 py-5 md:pr-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-porcelain/60">Evidence map</h2>
          <FocusGraph finding={focus} />
        </div>
      </div>

      <footer className="border-t border-forest-2 px-6 py-4 md:px-8">
        <AgentActions target={focus} busy={phase.kind === "analyzing"} />
      </footer>
    </section>
  );
}

function StreamToggle({ mode, onChange }: { mode: StreamMode; onChange: (m: StreamMode) => void }) {
  const options: { value: StreamMode; label: string }[] = [
    { value: "case", label: "This case" },
    { value: "all", label: "All" },
  ];
  return (
    <div role="radiogroup" aria-label="Activity scope" className="flex rounded-full bg-forest-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-petal",
            mode === o.value ? "bg-petal text-forest" : "text-porcelain/70 hover:text-porcelain",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
