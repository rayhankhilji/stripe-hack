"use client";

import type { FindingSummaryDTO } from "@ghost/shared";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { FixtureBadge } from "../../components/ghost/fixture-badge";
import { Money } from "../../components/ghost/money";
import { StatusPill } from "../../components/ghost/status-pill";
import { cn } from "../../lib/cn";
import { SectionCard } from "./section-card";

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-lime" : score >= 50 ? "bg-lemon" : "bg-petal";
  return (
    <span className="flex items-center gap-1.5" title={`Evidence score ${score} of 100`}>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${score}%` }} />
      </span>
      <span className="font-mono text-xs tabular-nums text-ink/60">{score}</span>
      <span className="sr-only">evidence score {score} of 100</span>
    </span>
  );
}

export function TopOpportunities({ findings }: { findings: FindingSummaryDTO[] }) {
  const top = findings.slice(0, 5);
  return (
    <SectionCard
      title="Top opportunities"
      action={
        <Link href="/recovery" className="text-xs font-medium text-ink/60 transition-colors hover:text-punch">
          View all
        </Link>
      }
    >
      {top.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink/60">No unbilled revenue found yet. Run a hunt to check every closed-won deal.</p>
      ) : (
        <ul className="divide-y divide-line">
          {top.map((f) => (
            <li key={f.id}>
              <Link
                href={`/recovery/${f.id}`}
                className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-porcelain focus-visible:bg-porcelain focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{f.customerName}</span>
                    {f.isFixture ? <FixtureBadge /> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink/60">{f.title}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <StatusPill status={f.status} />
                    <ScoreBar score={f.evidenceScore} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Money cents={f.amountCents} size="md" />
                  <ArrowUpRight
                    aria-hidden
                    className="size-4 text-ink/30 transition-transform duration-fast group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-punch"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
