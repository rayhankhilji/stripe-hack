"use client";

import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { CircleCheck } from "lucide-react";
import { formatCents, type FindingDetailDTO } from "@ghost/shared";
import { MonoId } from "../../components/ghost/mono-id";
import { paymentVerification } from "./case-model";
import { timestamp } from "./time";

export function RecoveredPanel({ finding }: { finding: FindingDetailDTO }) {
  const amount = finding.invoice?.amountPaidCents ?? finding.amountCents;
  const shown = useCountUp(amount);
  const proof = paymentVerification(finding.timeline);

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-lime p-5 text-forest">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CircleCheck className="size-5" aria-hidden />
        Recovered
      </div>
      <p className="text-3xl font-semibold tabular-nums tracking-tight" aria-label={`Recovered ${formatCents(amount)}`}>
        {formatCents(shown)}
      </p>
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

/** Counts up to the integer cent value once; reduced-motion users see the final number. */
function useCountUp(target: number): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, target, { duration: 1.2, ease: [0.2, 0, 0, 1], onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [target, reduce]);
  return reduce ? target : value;
}
