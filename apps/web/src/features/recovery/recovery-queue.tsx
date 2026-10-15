"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FindingSummaryDTO } from "@ghost/shared";
import { useFindings } from "../../lib/queries";
import { PageHeader } from "../../components/ghost/page-header";
import { Money } from "../../components/ghost/money";
import { StatusPill } from "../../components/ghost/status-pill";
import { FixtureBadge } from "../../components/ghost/fixture-badge";
import { Panel } from "../../components/ui/panel";
import { Skeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { Tooltip } from "../../components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { cn } from "../../lib/cn";
import { EvidenceScoreBar } from "./evidence-score-bar";
import { QUEUE_GROUPS, countByGroup, inGroup, isQueueGroupKey, rankFindings, type QueueGroupKey } from "./queue-model";
import { relativeTime } from "./time";

export function RecoveryQueue() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = params.get("tab");
  const tab: QueueGroupKey = isQueueGroupKey(tabParam) ? tabParam : "all";
  const findings = useFindings();

  const all = useMemo(() => rankFindings(findings.data?.items ?? []), [findings.data]);
  const counts = useMemo(() => countByGroup(all), [all]);
  const visible = useMemo(() => all.filter((f) => inGroup(f.status, tab)), [all, tab]);
  const total = useMemo(() => visible.reduce((s, f) => s + f.amountCents, 0), [visible]);

  const selectTab = (key: QueueGroupKey) => {
    const next = new URLSearchParams(params);
    if (key === "all") next.delete("tab");
    else next.set("tab", key);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recovery"
        description="Revenue Ghost found that was earned but never billed, ranked by amount × evidence strength."
      />

      <div role="tablist" aria-label="Filter by status" className="flex flex-wrap items-center gap-1">
        {QUEUE_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={tab === g.key}
            onClick={() => selectTab(g.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              tab === g.key
                ? "bg-forest text-porcelain dark:bg-petal dark:text-forest"
                : "text-fg-muted hover:bg-surface hover:text-fg",
            )}
          >
            {g.label}
            <span
              className={cn(
                "rounded-full px-1.5 font-mono text-xs tabular-nums",
                tab === g.key ? "bg-petal text-forest" : "bg-border text-fg-muted",
              )}
            >
              {findings.isSuccess ? counts[g.key] : "–"}
            </span>
          </button>
        ))}
        {findings.isSuccess && visible.length > 0 ? (
          <div className="ml-auto flex items-baseline gap-2 text-sm text-fg-subtle">
            <span>{visible.length === 1 ? "1 case" : `${visible.length} cases`}</span>
            <span aria-hidden>·</span>
            <Money cents={total} size="sm" />
          </div>
        ) : null}
      </div>

      <Panel padding="none" className="overflow-hidden">
        <QueueBody
          state={findings}
          rows={visible}
          tab={tab}
          onOpen={(id) => router.push(`/recovery/${id}`)}
          onShowAll={() => selectTab("all")}
        />
      </Panel>

      {findings.data?.nextCursor ? (
        <p className="text-sm text-fg-subtle">
          Showing the first {all.length} cases from the API. Narrow the queue with a status tab to see the rest.
        </p>
      ) : null}
    </div>
  );
}

type QueueBodyProps = {
  state: ReturnType<typeof useFindings>;
  rows: FindingSummaryDTO[];
  tab: QueueGroupKey;
  onOpen: (id: string) => void;
  onShowAll: () => void;
};

function QueueBody({ state, rows, tab, onOpen, onShowAll }: QueueBodyProps) {
  const now = useNow();
  if (state.isPending) return <QueueSkeleton />;
  if (state.isError) {
    return (
      <ErrorState
        title="Couldn't load the recovery queue"
        error={state.error}
        retrying={state.isFetching}
        onRetry={() => void state.refetch()}
      />
    );
  }
  if (state.data.items.length === 0) {
    return (
      <EmptyState
        title="No recoverable revenue yet"
        description="Sync Sapora Networks' records and run detection from the workspace. Every case Ghost finds lands here."
        action={
          <Link href="/" className="text-sm font-medium text-punch underline-offset-4 hover:underline">
            Go to the workspace
          </Link>
        }
      />
    );
  }
  if (rows.length === 0) {
    const label = QUEUE_GROUPS.find((g) => g.key === tab)?.label ?? "this group";
    return (
      <EmptyState
        title={`Nothing in ${label}`}
        description="No case is in this state right now."
        action={
          <button
            type="button"
            onClick={onShowAll}
            className="text-sm font-medium text-punch underline-offset-4 hover:underline"
          >
            Show all cases
          </button>
        }
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Case</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Evidence</TableHead>
          <TableHead>Rules</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((f) => (
          <TableRow key={f.id} className="cursor-pointer" onClick={() => onOpen(f.id)}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium text-fg">{f.customerName}</span>
                {f.isFixture ? <FixtureBadge /> : null}
              </div>
            </TableCell>
            <TableCell>
              <Link
                href={`/recovery/${f.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-fg-muted underline-offset-4 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus"
              >
                {f.title}
              </Link>
              <div className="font-mono text-xs text-fg-subtle">
                {f.evidenceCount === 1 ? "1 source" : `${f.evidenceCount} sources`}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <Money cents={f.amountCents} />
            </TableCell>
            <TableCell>
              <EvidenceScoreBar score={f.evidenceScore} />
            </TableCell>
            <TableCell>
              <FailingRules rules={f.failingRules} />
            </TableCell>
            <TableCell>
              <StatusPill status={f.status} />
            </TableCell>
            <TableCell className="text-right">
              <time dateTime={f.updatedAt} className="whitespace-nowrap font-mono text-xs text-fg-subtle" title={f.updatedAt}>
                {relativeTime(f.updatedAt, now)}
              </time>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FailingRules({ rules }: { rules: FindingSummaryDTO["failingRules"] }) {
  if (rules.length === 0) return <span className="text-sm text-fg-subtle">All clear</span>;
  return (
    <Tooltip content={`Rules flagged: ${rules.join(", ")}`}>
      <div className="flex flex-wrap gap-1">
        {rules.map((r) => (
          <span key={r} className="rounded-md bg-punch/10 px-1.5 py-0.5 font-mono text-xs text-punch">
            {r}
          </span>
        ))}
      </div>
    </Tooltip>
  );
}

function QueueSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border" aria-busy="true" aria-label="Loading recovery queue">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-2 w-16" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Wall clock for relative "updated" times, ticking every 30s so labels don't go stale. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
