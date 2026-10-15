"use client";

import { Bot, ChevronDown, CreditCard, Cog, User } from "lucide-react";
import { useId, useState } from "react";
import type { AuditEventDTO } from "@ghost/shared";
import { MonoId } from "../../components/ghost/mono-id";
import { cn } from "../../lib/cn";
import { KIND_META } from "./audit-kinds";

const ACTOR_ICON = { agent: Bot, operator: User, system: Cog, stripe: CreditCard } as const;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace("T", " ").slice(0, 19);
}

export function AuditRow({ event }: { event: AuditEventDTO }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const Icon = ACTOR_ICON[event.actorType];
  const meta = KIND_META[event.kind];
  const hasData = Object.keys(event.data).length > 0;

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-4 px-4 py-3">
        <time dateTime={event.occurredAt} className="font-mono text-xs text-ink/70">
          {formatTime(event.occurredAt)}
        </time>
        <span className="flex items-center gap-2 text-sm text-ink" title={event.actorType}>
          <Icon aria-label={event.actorType} className="size-4 text-ink/70" />
          <span className="max-w-32 truncate">{event.actor}</span>
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{event.summary}</p>
          <p className="font-mono text-xs text-ink/50">{event.action}</p>
        </div>
        <span className="flex items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", meta.pillClass)}>{meta.label}</span>
          {event.externalRef ? <MonoId value={event.externalRef} /> : null}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Hide event data" : "Show event data"}
          disabled={!hasData}
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-1 text-ink/60 outline-none hover:bg-porcelain focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-30"
        >
          <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
      {open ? (
        <pre id={panelId} className="mx-4 mb-3 overflow-x-auto rounded-xl bg-forest p-4 font-mono text-xs leading-relaxed text-porcelain">
          {JSON.stringify(event.data, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}
