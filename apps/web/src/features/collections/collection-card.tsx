import { ExternalLink, ShieldAlert } from "lucide-react";
import type { CollectionItemDTO } from "@ghost/shared";
import { Panel } from "../../components/ui/panel";
import { Money } from "../../components/ghost/money";
import { StatusPill } from "../../components/ghost/status-pill";
import { SourceChip } from "../../components/ghost/source-chip";
import { deriveSequence, NEXT_ACTION_LABEL } from "./sequence";
import { SequenceTrack } from "./sequence-track";
import { cn } from "../../lib/cn";

const ACTION_TONE: Record<CollectionItemDTO["nextAction"], string> = {
  none: "bg-porcelain text-ink/70",
  send_reminder: "bg-petal text-forest",
  escalate_dispute: "bg-lemon text-forest",
  await_payment: "bg-signal/20 text-navy",
  suppressed_paid: "bg-lime text-forest",
};

export function CollectionCard({ item }: { item: CollectionItemDTO }) {
  const { invoice } = item;
  return (
    <Panel className="flex flex-col gap-5 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{invoice.customerName}</h2>
          <p className="font-mono text-xs text-ink/60">{invoice.number ?? invoice.stripeInvoiceId}</p>
        </div>
        <div className="flex items-center gap-3">
          <Money cents={invoice.status === "paid" ? invoice.amountPaidCents : invoice.amountDueCents} />
          <StatusPill status={invoice.status} />
        </div>
      </header>

      <SequenceTrack steps={deriveSequence(item)} />

      {item.disputeSignals.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-lemon/30 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <ShieldAlert aria-hidden className="size-4" /> Dispute on record: reminders hold for a human
          </p>
          <div className="flex flex-wrap gap-2">
            {item.disputeSignals.map((e) => (
              <SourceChip key={e.id} system={e.source.system} externalId={e.source.externalId} title={e.source.title} />
            ))}
          </div>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", ACTION_TONE[item.nextAction])}>
          Next: {NEXT_ACTION_LABEL[item.nextAction]}
        </span>
        {invoice.hostedInvoiceUrl && (
          <a
            href={invoice.hostedInvoiceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-navy hover:underline"
          >
            Stripe invoice <ExternalLink aria-hidden className="size-3.5" />
          </a>
        )}
      </footer>
    </Panel>
  );
}
