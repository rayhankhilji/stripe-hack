import type { FindingStatus } from "@ghost/shared";
import { cn } from "../../lib/cn";
import { statusMeta } from "../../lib/format/status";
import { Badge } from "../ui/badge";

// Mirrors the InvoiceStatus / OutboxStatus / ReminderStatus / ExpansionStatus enums in @ghost/shared,
// which export only zod schemas (web does not depend on zod directly).
type AnyStatus =
  | FindingStatus
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible"
  | "pending_approval"
  | "sent_simulated"
  | "suppressed"
  | "scheduled"
  | "drafted"
  | "cancelled";

export type StatusPillProps = {
  status: AnyStatus;
  size?: "sm" | "md";
  className?: string;
};

/** One status vocabulary across findings, invoices, outbox, reminders and expansion. Live states pulse their dot once. */
export function StatusPill({ status, size = "md", className }: StatusPillProps) {
  const meta = statusMeta(status);
  return (
    <Badge
      tone={meta.tone}
      size={size}
      className={cn(status === "suppressed" && "line-through decoration-1", className)}
    >
      <span aria-hidden className="relative flex size-1.5">
        {meta.live ? (
          <span className="absolute inline-flex size-full rounded-full bg-current opacity-60 motion-safe:animate-ping" />
        ) : null}
        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
      </span>
      {meta.label}
    </Badge>
  );
}
