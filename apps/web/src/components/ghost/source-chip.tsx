"use client";

import type { EraSystem, SourceRef } from "@ghost/shared";
import { useState } from "react";
import { cn } from "../../lib/cn";
import { SourceDrawer } from "./source-drawer";
import { SystemIcon } from "./system-icon";

type FlatSource = {
  system: EraSystem;
  externalId: string;
  title: string;
  recordType?: string;
  url?: string | null;
  occurredAt?: string | null;
  isFixture?: boolean;
};

export type SourceChipProps = (
  ({ source: SourceRef } & Partial<Record<keyof FlatSource, never>>) | ({ source?: undefined } & FlatSource)
) & {
  /** Verbatim quote shown in the drawer. */
  quote?: string;
  verified?: boolean;
  /** Show only the external id (compact rows). */
  compact?: boolean;
  className?: string;
};

/** Clickable citation of a source record: system tile + id + title. Opens SourceDrawer. */
export function SourceChip(props: SourceChipProps) {
  const { quote, verified, compact, className } = props;
  const [open, setOpen] = useState(false);
  const source: SourceRef = props.source ?? {
    system: props.system,
    externalId: props.externalId,
    title: props.title,
    recordType: props.recordType ?? "record",
    url: props.url ?? null,
    occurredAt: props.occurredAt ?? null,
    isFixture: props.isFixture ?? false,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${source.title} (${source.externalId})`}
        className={cn(
          "group/chip inline-flex h-7 max-w-full items-center gap-1.5 rounded-control border border-border bg-surface pl-1 pr-2.5 text-xs text-fg",
          "transition-[border-color,background-color,box-shadow] duration-180 ease-ghost hover:border-border-strong hover:bg-surface-muted hover:shadow-soft",
          className,
        )}
      >
        <SystemIcon system={source.system} size="xs" />
        <span className="font-mono text-fg-muted">{source.externalId}</span>
        {compact ? null : <span className="min-w-0 truncate font-medium">{source.title}</span>}
      </button>
      <SourceDrawer source={source} open={open} onOpenChange={setOpen} quote={quote} verified={verified} />
    </>
  );
}
