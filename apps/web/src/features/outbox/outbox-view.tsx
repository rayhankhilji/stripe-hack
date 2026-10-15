"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import type { OutboxStatus } from "@ghost/shared";
import { useDecideOutbox, useOutbox } from "../../lib/queries/outbox";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { Skeleton } from "../../components/ui/skeleton";
import { PageHeader } from "../../components/ghost/page-header";
import { StatusPill } from "../../components/ghost/status-pill";
import { cn } from "../../lib/cn";
import { OutboxMessage } from "./outbox-message";

const FILTERS: { label: string; value: OutboxStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Pending", value: "pending_approval" },
  { label: "Sent (sandbox)", value: "sent_simulated" },
  { label: "Rejected", value: "rejected" },
  { label: "Suppressed", value: "suppressed" },
];

export function OutboxView() {
  const [status, setStatus] = useState<OutboxStatus | undefined>(undefined);
  const [picked, setPicked] = useState<string | null>(null);
  const focus = useSearchParams().get("m");
  const outbox = useOutbox(status);
  const decide = useDecideOutbox();

  const messages = outbox.data ?? [];
  const selectedId = picked ?? focus;
  const selected = messages.find((m) => m.id === selectedId) ?? messages[0];

  return (
    <div className="flex flex-col gap-6 p-8">
      <PageHeader title="Outbox" description="Every message Ghost drafts waits here for a human decision." />

      <p role="note" className="flex items-center gap-2 rounded-lg bg-forest px-4 py-3 text-sm text-petal">
        <ShieldCheck aria-hidden className="size-4 shrink-0" />
        External emails require approval · delivered to sandbox only
      </p>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setStatus(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              status === f.value ? "border-forest bg-forest text-porcelain" : "border-line bg-white text-ink hover:bg-porcelain",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {outbox.isLoading && (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]" aria-busy="true">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}
      {outbox.isError && (
        <ErrorState title="Could not load the outbox" message={outbox.error.message} onRetry={() => void outbox.refetch()} />
      )}
      {outbox.data && messages.length === 0 && (
        <EmptyState
          title={status ? "No messages with this status" : "The outbox is empty"}
          description="Reminders and expansion emails appear here once Ghost drafts them."
        />
      )}
      {selected && (
        <div className="grid items-start gap-4 lg:grid-cols-[22rem_1fr]">
          <ul className="flex flex-col gap-2" aria-label="Messages">
            {messages.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-current={m.id === selected.id}
                  onClick={() => setPicked(m.id)}
                  className={cn(
                    "flex w-full flex-col gap-2 rounded-xl border p-4 text-left",
                    m.id === selected.id ? "border-forest bg-white" : "border-line bg-white/60 hover:bg-white",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{m.subject}</span>
                    <StatusPill status={m.status} />
                  </span>
                  <span className="truncate font-mono text-xs text-ink/60">{m.toAddress}</span>
                </button>
              </li>
            ))}
          </ul>
          <OutboxMessage
            message={selected}
            deciding={decide.isPending}
            onDecide={(decision) => decide.mutate({ id: selected.id, decision })}
          />
        </div>
      )}
      {decide.isError && <ErrorState title="Decision failed" message={decide.error.message} />}
    </div>
  );
}
