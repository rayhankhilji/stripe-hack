"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { SourceRef } from "@ghost/shared";
import { BadgeCheck, ExternalLink, Quote, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format/date";
import { systemLabel } from "../../lib/format/systems";
import { KeyValue } from "../ui/key-value";
import { FixtureBadge } from "./fixture-badge";
import { MonoId } from "./mono-id";
import { SystemIcon } from "./system-icon";

export type SourceDrawerProps = {
  source: SourceRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Verbatim span cited from this record. */
  quote?: string;
  /** Whether the quote was found verbatim in the stored record body. */
  verified?: boolean;
  /** Extra content (e.g. related records). */
  children?: ReactNode;
};

/** Right-hand sheet showing one source record: the underlying evidence is always one click away. */
export function SourceDrawer({ source, open, onOpenChange, quote, verified, children }: SourceDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-forest/30 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-2 right-2 z-50 flex w-[min(30rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-panel border border-border bg-surface text-fg shadow-lift outline-none",
            "data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in",
          )}
        >
          <div className="flex items-start gap-3 border-b border-border px-6 py-5">
            <SystemIcon system={source.system} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-fg-subtle">
                {systemLabel(source.system)} · {source.recordType}
              </p>
              <DialogPrimitive.Title className="mt-0.5 text-base font-semibold leading-snug tracking-tight">{source.title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Source record {source.externalId} from {systemLabel(source.system)}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mr-2 grid size-8 shrink-0 place-items-center rounded-control text-fg-subtle transition-colors duration-180 hover:bg-surface-muted hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5 scrollbar-quiet">
            {quote ? (
              <figure className="rounded-card bg-surface-muted p-4">
                <Quote className="mb-2 size-4 text-punch dark:text-petal" aria-hidden />
                <blockquote className="font-mono text-xs leading-relaxed text-fg">{quote}</blockquote>
                <figcaption className="mt-3 flex items-center gap-1.5 text-xs">
                  {verified ? (
                    <>
                      <BadgeCheck className="size-3.5 text-lime-deep dark:text-lime" aria-hidden />
                      <span className="text-lime-deep dark:text-lime">Verified verbatim in source record</span>
                    </>
                  ) : verified === false ? (
                    <span className="text-punch">Not found verbatim in source record</span>
                  ) : null}
                </figcaption>
              </figure>
            ) : null}

            <KeyValue
              items={[
                { label: "System", value: systemLabel(source.system) },
                { label: "Record type", value: source.recordType },
                { label: "External ID", value: <MonoId value={source.externalId} /> },
                { label: "Occurred", value: source.occurredAt ? formatDateTime(source.occurredAt) : null },
              ]}
            />

            {source.isFixture ? <FixtureBadge /> : null}
            {children}
          </div>

          {source.url ? (
            <div className="border-t border-border px-6 py-4">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-fg underline-offset-4 hover:underline"
              >
                Open in {systemLabel(source.system)}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
