"use client";

import type { OverviewDTO } from "@ghost/shared";
import { SystemIcon } from "../../components/ghost/system-icon";
import { formatRelative } from "../../lib/format/date";
import { cn } from "../../lib/cn";
import { SYSTEM_LABEL, SYSTEM_ORDER } from "./copy";
import { systemRecords } from "./derive";
import { SectionCard } from "./section-card";

const numberFormat = new Intl.NumberFormat("en-US");

export function ConnectedSystems({ overview }: { overview: OverviewDTO }) {
  const connected = overview.systemsConnected.filter((s) => s.records > 0).length;
  return (
    <SectionCard
      title="Connected systems"
      action={<span className="font-mono text-xs tabular-nums text-fg-subtle">{connected}/7 synced</span>}
    >
      <ul className="grid grid-cols-1 gap-x-2 px-2 pb-2 sm:grid-cols-2 lg:grid-cols-1">
        {SYSTEM_ORDER.map((system) => {
          const { records, lastSyncedAt } = systemRecords(overview, system);
          const live = records > 0;
          return (
            <li
              key={system}
              className="flex items-center gap-2.5 rounded-control px-2 py-1.5"
              title={lastSyncedAt ? `Last synced ${formatRelative(lastSyncedAt)}` : "Not synced yet"}
            >
              <SystemIcon system={system} size="sm" inactive={!live} />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{SYSTEM_LABEL[system]}</span>
              <span className={cn("font-mono text-xs tabular-nums", live ? "text-fg-muted" : "text-fg-subtle")}>
                {live ? numberFormat.format(records) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
