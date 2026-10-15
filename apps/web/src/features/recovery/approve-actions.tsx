"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { FindingDetailDTO } from "@ghost/shared";
import { useApproveFinding, useRejectFinding } from "../../lib/queries";
import { Button } from "../../components/ui/button";
import { Money } from "../../components/ghost/money";
import { ConfirmDialog } from "./confirm-dialog";
import { flaggedChecks } from "./case-model";

export function ApproveActions({ finding }: { finding: FindingDetailDTO }) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const approve = useApproveFinding();
  const reject = useRejectFinding();
  const flagged = flaggedChecks(finding.eligibility);
  const busy = approve.isPending || reject.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Awaiting your approval</span>
        <p className="text-sm text-fg-muted">
          Ghost recommends invoicing this revenue. Nothing is sent to Stripe until you approve.
        </p>
      </div>
      {flagged.length > 0 ? <FlaggedRules checks={flagged} /> : null}
      <Button variant="primary" size="md" onClick={() => setApproveOpen(true)} disabled={busy}>
        Approve & create Stripe invoice
      </Button>
      <Button variant="ghost" size="md" onClick={() => setRejectOpen(true)} disabled={busy}>
        Reject
      </Button>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={(o) => !approve.isPending && setApproveOpen(o)}
        title="Create a Stripe test-mode invoice?"
        description={`Ghost will create and finalize an invoice for ${finding.customerName}. Payment is confirmed only by a verified Stripe webhook.`}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setApproveOpen(false)} disabled={approve.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={approve.isPending}
              onClick={() =>
                approve.mutate(
                  { id: finding.id, ...(note.trim() ? { note: note.trim() } : {}) },
                  { onSuccess: () => setApproveOpen(false) },
                )
              }
            >
              {approve.isPending ? "Creating invoice…" : "Approve & invoice"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between rounded-card bg-surface-muted px-4 py-3">
            <span className="text-sm text-fg-muted">Invoice total</span>
            <Money cents={finding.amountCents} size="lg" />
          </div>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {finding.lines.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-fg-muted">{l.description}</span>
                <Money cents={l.amountCents} size="sm" />
              </li>
            ))}
          </ul>
          {flagged.length > 0 ? <FlaggedRules checks={flagged} /> : null}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">Note for the audit trail (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="rounded-control border border-border bg-surface px-3 py-2 text-fg focus:border-focus focus:outline-none"
            />
          </label>
          {approve.isError ? <p className="text-sm text-punch">{approve.error.message}</p> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={(o) => !reject.isPending && setRejectOpen(o)}
        title="Reject this case?"
        description="Rejected cases are never invoiced. Your reason is recorded in the audit trail."
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setRejectOpen(false)} disabled={reject.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              disabled={reject.isPending || reason.trim().length < 3}
              onClick={() =>
                reject.mutate({ id: finding.id, reason: reason.trim() }, { onSuccess: () => setRejectOpen(false) })
              }
            >
              {reject.isPending ? "Rejecting…" : "Reject case"}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">Reason (at least 3 characters)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            className="rounded-control border border-border bg-surface px-3 py-2 text-fg focus:border-focus focus:outline-none"
          />
        </label>
        {reject.isError ? <p className="text-sm text-punch">{reject.error.message}</p> : null}
      </ConfirmDialog>
    </div>
  );
}

function FlaggedRules({ checks }: { checks: FindingDetailDTO["eligibility"] }) {
  return (
    <ul className="flex flex-col gap-2 rounded-card bg-lemon-soft text-lemon-deep dark:bg-lemon/15 dark:text-lemon p-3 text-sm">
      {checks.map((c) => (
        <li key={c.ruleId} className="flex gap-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-fg" aria-hidden />
          <span>
            <span className="font-mono text-xs font-medium">{c.ruleId}</span> {c.name}:{" "}
            <span className="text-fg-muted">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
