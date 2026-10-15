"use client";

import { CircleCheck } from "lucide-react";
import type { FindingDetailDTO } from "@ghost/shared";
import { Money } from "../../components/ghost/money";
import { MonoId } from "../../components/ghost/mono-id";
import { paymentVerification } from "./case-model";
import { timestamp } from "./time";

export function RecoveredPanel({ finding }: { finding: FindingDetailDTO }) {
  const amount = finding.invoice?.amountPaidCents ?? finding.amountCents;
  const proof = paymentVerification(finding.timeline);

  return (
    <div className="flex flex-col gap-4 rounded-card bg-lime p-5 text-forest">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CircleCheck className="size-5" aria-hidden />
        Recovered
      </div>
      <Money cents={amount} size="xl" animate />
      <div className="flex flex-col gap-1 text-sm">
        {proof ? (
          <>
            <span>{proof.via === "webhook" ? "Verified by Stripe webhook" : "Verified by Stripe API fetch"}</span>
            {proof.eventId ? <MonoId value={proof.eventId} /> : null}
            <span className="font-mono text-xs opacity-70">{timestamp(proof.at)}</span>
          </>
        ) : (
          <span>Paid on Stripe{finding.invoice?.paidAt ? ` · ${timestamp(finding.invoice.paidAt)}` : ""}</span>
        )}
        {finding.invoice ? <MonoId value={finding.invoice.stripeInvoiceId} /> : null}
      </div>
      <p className="text-xs opacity-80">Collection reminders for this invoice are suppressed.</p>
    </div>
  );
}
