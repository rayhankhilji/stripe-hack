"use client";

import { Ban, CircleX, ShieldAlert } from "lucide-react";
import type { FindingDetailDTO } from "@ghost/shared";
import { useAnalyzeFinding } from "../../lib/queries";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";
import { ApproveActions } from "./approve-actions";
import { InvoicePanel } from "./invoice-panel";
import { RecoveredPanel } from "./recovered-panel";
import { agentSteps, latestError } from "./case-model";
import { timestamp } from "./time";

/** The sticky right panel. Exactly one next step per finding status (FAST_PLAN U3 table). */
export function ActionPanel({ finding }: { finding: FindingDetailDTO }) {
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <PanelBody finding={finding} />
    </Panel>
  );
}

function PanelBody({ finding }: { finding: FindingDetailDTO }) {
  switch (finding.status) {
    case "detected":
      return <Investigate finding={finding} intro="Ghost detected this case. Investigate to gather evidence, check eligibility and explain it." />;
    case "needs_review":
      return (
        <Investigate
          finding={finding}
          intro={finding.decisionReason ?? "A rule failed or evidence conflicts. Fix the source records, then re-investigate."}
          tone="warn"
        />
      );
    case "failed": {
      const err = latestError(finding.timeline);
      return (
        <Investigate
          finding={finding}
          intro={err ? `Last run failed: ${err.summary}` : "The last run failed. See the timeline for details."}
          tone="error"
        />
      );
    }
    case "analyzing":
      return <Analyzing finding={finding} />;
    case "ready_for_approval":
      return <ApproveActions finding={finding} />;
    case "approved":
    case "invoiced":
      return <InvoicePanel finding={finding} />;
    case "recovered":
      return <RecoveredPanel finding={finding} />;
    case "escalated":
      return (
        <Terminal icon={<ShieldAlert className="size-5 text-punch" aria-hidden />} title="Escalated">
          {finding.decisionReason ?? "A dispute is on record. Ghost will not invoice this case; it needs a person to resolve it."}
        </Terminal>
      );
    case "rejected":
      return (
        <Terminal icon={<Ban className="size-5 text-ink/60" aria-hidden />} title="Rejected">
          {finding.approval
            ? `${finding.approval.actor} rejected this case${finding.approval.note ? `: “${finding.approval.note}”` : "."} · ${timestamp(finding.approval.at)}`
            : "This case was rejected and will not be invoiced."}
        </Terminal>
      );
  }
}

function Investigate({ finding, intro, tone }: { finding: FindingDetailDTO; intro: string; tone?: "warn" | "error" }) {
  const analyze = useAnalyzeFinding();
  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wider text-ink/50">Next step</span>
      <p className={tone === "error" ? "text-sm text-punch" : tone === "warn" ? "text-sm text-ink" : "text-sm text-ink/70"}>
        {tone === "error" ? <CircleX className="mr-1 inline size-4 align-text-bottom" aria-hidden /> : null}
        {intro}
      </p>
      <Button variant="primary" size="md" disabled={analyze.isPending} onClick={() => analyze.mutate(analyzeVars(finding.id))}>
        {analyze.isPending ? "Investigating…" : finding.status === "detected" ? "Investigate" : "Re-investigate"}
      </Button>
      {analyze.isError ? <p className="text-sm text-punch">{analyze.error.message}</p> : null}
    </div>
  );
}

// useAnalyzeFinding types its variables as `{id} & Record<string, never>`, which no object literal
// satisfies; the analyze route takes no body, so only `id` is ever sent.
function analyzeVars(id: string) {
  return { id } as Parameters<ReturnType<typeof useAnalyzeFinding>["mutate"]>[0];
}

function Analyzing({ finding }: { finding: FindingDetailDTO }) {
  const steps = agentSteps(finding.timeline);
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <span className="text-xs font-medium uppercase tracking-wider text-ink/50">Ghost is investigating</span>
      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-3 text-sm">
            <span className={s.state === "error" ? "mt-1.5 size-2 shrink-0 rounded-full bg-punch" : "mt-1.5 size-2 shrink-0 rounded-full bg-forest-2"} />
            <span className="flex flex-col">
              <span className="text-ink">{s.title}</span>
              <span className="font-mono text-xs text-ink/50">{timestamp(s.at)}</span>
            </span>
          </li>
        ))}
        <li className="flex items-center gap-3 text-sm text-ink/60">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-petal motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-punch" />
          </span>
          Working…
        </li>
      </ol>
    </div>
  );
}

function Terminal({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 font-medium text-ink">
        {icon}
        {title}
      </div>
      <p className="text-sm text-ink/70">{children}</p>
    </div>
  );
}
