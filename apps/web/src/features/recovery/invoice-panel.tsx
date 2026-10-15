"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { FindingDetailDTO, InvoiceDTO } from "@ghost/shared";
import { keys, useRefreshInvoice } from "../../lib/queries";
import { Button } from "../../components/ui/button";
import { Money } from "../../components/ghost/money";
import { MonoId } from "../../components/ghost/mono-id";
import { StatusPill } from "../../components/ghost/status-pill";
import { calendarDate, timestamp } from "./time";

/** approved → invoice being created; invoiced → open on Stripe, waiting for the verified webhook. */
export function InvoicePanel({ finding }: { finding: FindingDetailDTO }) {
  const invoice = finding.invoice;
  if (!invoice) {
    return (
      <div className="flex flex-col gap-3">
        <LiveDot label="Creating the Stripe invoice…" />
        <p className="text-sm text-ink/70">
          Approved{finding.approval ? ` by ${finding.approval.actor}` : ""}. Ghost is creating and finalizing the invoice in Stripe test mode.
        </p>
      </div>
    );
  }
  return <InvoiceDetails findingId={finding.id} invoice={invoice} />;
}

function InvoiceDetails({ findingId, invoice }: { findingId: string; invoice: InvoiceDTO }) {
  const qc = useQueryClient();
  const refresh = useRefreshInvoice();
  const open = invoice.status === "open" || invoice.status === "draft";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-ink/50">Stripe invoice</span>
        <StatusPill status={invoice.status} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">{invoice.number ?? "Number pending"}</span>
        <MonoId value={invoice.stripeInvoiceId} />
      </div>
      <ul className="flex flex-col divide-y divide-line text-sm">
        {invoice.lines.map((l, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-2">
            <span className="text-ink/80">{l.description}</span>
            <Money cents={l.amountCents} size="sm" />
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm text-ink/70">Amount due</span>
        <Money cents={invoice.amountDueCents} size="lg" />
      </div>
      {invoice.dueDate ? <p className="text-xs text-ink/60">Due {calendarDate(invoice.dueDate)}</p> : null}

      {invoice.hostedInvoiceUrl ? (
        <a
          href={invoice.hostedInvoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-punch px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-punch"
        >
          Open payment page <ExternalLink className="size-4" aria-hidden />
        </a>
      ) : (
        <p className="text-sm text-ink/60">Stripe hasn't returned a hosted payment page for this invoice yet.</p>
      )}

      <Button
        variant="secondary"
        size="sm"
        disabled={refresh.isPending}
        onClick={() =>
          refresh.mutate(invoice.id, { onSuccess: () => void qc.invalidateQueries({ queryKey: keys.finding(findingId) }) })
        }
      >
        <RefreshCw className={refresh.isPending ? "size-4 animate-spin" : "size-4"} aria-hidden />
        Refresh from Stripe
      </Button>
      {refresh.isError ? <p className="text-sm text-punch">{refresh.error.message}</p> : null}
      {invoice.lastSyncedAt ? <p className="font-mono text-xs text-ink/50">Synced {timestamp(invoice.lastSyncedAt)}</p> : null}

      {open ? <LiveDot label="Awaiting verified webhook…" /> : null}
      {invoice.status === "void" || invoice.status === "uncollectible" ? (
        <p className="text-sm text-punch">Stripe marked this invoice {invoice.status}. It will not be collected.</p>
      ) : null}
    </div>
  );
}

function LiveDot({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink/70" role="status" aria-live="polite">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2.5 rounded-full bg-signal" />
      </span>
      {label}
    </div>
  );
}
