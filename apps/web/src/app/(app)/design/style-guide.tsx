"use client";

import type { AuditEventDTO, EligibilityCheckDTO, EraSystem } from "@ghost/shared";
import { FileSearch, Play, RotateCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ActivityStream } from "../../../components/ghost/activity-stream";
import { AgentStep } from "../../../components/ghost/agent-step";
import { EvidenceGraph } from "../../../components/ghost/evidence-graph";
import { FixtureBadge } from "../../../components/ghost/fixture-badge";
import { MonoId } from "../../../components/ghost/mono-id";
import { Money } from "../../../components/ghost/money";
import { PageHeader } from "../../../components/ghost/page-header";
import { RuleRow } from "../../../components/ghost/rule-row";
import { SourceChip } from "../../../components/ghost/source-chip";
import { StatusPill, type StatusPillProps } from "../../../components/ghost/status-pill";
import { SystemIcon } from "../../../components/ghost/system-icon";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "../../../components/ui/dialog";
import { EmptyState } from "../../../components/ui/empty-state";
import { ErrorState } from "../../../components/ui/error-state";
import { KeyValue } from "../../../components/ui/key-value";
import { Panel } from "../../../components/ui/panel";
import { Skeleton } from "../../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Tooltip } from "../../../components/ui/tooltip";
import { ERA_SYSTEMS } from "../../../lib/format/systems";

// Specimens use the documented Tidewater Capital hero case (FAST_PLAN §0) so every figure on this page is real.
const TIDEWATER_LINES = [
  { deal: "deal-127", line: "oli-deal-127-0", cents: 1_640_000 },
  { deal: "deal-127", line: "oli-deal-127-1", cents: 3_510_000 },
  { deal: "deal-23", line: "deal-23", cents: 1_100_000 },
  { deal: "deal-24", line: "deal-24", cents: 970_000 },
];

const R10: EligibilityCheckDTO = {
  ruleId: "R-10",
  name: "Contract activated",
  outcome: "warn",
  detail: "contract-4 is In Approval Process: human approval required.",
};
const R04: EligibilityCheckDTO = {
  ruleId: "R-04",
  name: "No activated order exists",
  outcome: "pass",
  detail: "order-127, order-23 and order-24 are Draft.",
};
const R06: EligibilityCheckDTO = {
  ruleId: "R-06",
  name: "No dispute on record",
  outcome: "fail",
  detail: "Fail style: a dispute on record escalates the case.",
};

const FINDING_STATUSES: StatusPillProps["status"][] = [
  "detected",
  "analyzing",
  "needs_review",
  "escalated",
  "ready_for_approval",
  "approved",
  "invoiced",
  "recovered",
  "rejected",
  "failed",
];
const OTHER_STATUSES: StatusPillProps["status"][] = [
  "open",
  "paid",
  "void",
  "pending_approval",
  "sent_simulated",
  "suppressed",
  "scheduled",
  "drafted",
];

const SWATCHES = [
  ["forest", "bg-forest", "Ghost Forest"],
  ["forest-2", "bg-forest-2", "Deep Forest"],
  ["petal", "bg-petal", "Petal Pink"],
  ["punch", "bg-punch", "Punch Pink"],
  ["navy", "bg-navy", "Ocean Navy"],
  ["signal", "bg-signal", "Signal Blue"],
  ["lemon", "bg-lemon", "Lemon Yellow"],
  ["lime", "bg-lime", "Fresh Lime"],
  ["porcelain", "bg-porcelain", "Warm Porcelain"],
  ["line", "bg-line", "Soft Border"],
  ["ink", "bg-ink", "Ink"],
] as const;

function specimenEvent(
  i: number,
  kind: AuditEventDTO["kind"],
  actorType: AuditEventDTO["actorType"],
  summary: string,
  externalRef: string | null,
): AuditEventDTO {
  return {
    id: `00000000-0000-4000-8000-00000000000${i}`,
    occurredAt: new Date(Date.UTC(2026, 9, 15, 14, 0, i * 7)).toISOString(),
    actorType,
    actor: actorType === "agent" ? "ghost" : actorType === "stripe" ? "stripe" : "operator",
    kind,
    action: "specimen",
    summary,
    subjectType: "finding",
    subjectId: null,
    externalRef,
    data: {},
  };
}

// The order an investigation of the hero case unfolds in; replayed one step at a time to demo the motion.
const SCRIPT: AuditEventDTO[] = [
  specimenEvent(1, "info", "agent", "Read 3 Closed Won deals for Tidewater Capital", "deal-127"),
  specimenEvent(2, "info", "agent", "Orders order-127, order-23, order-24 are still Draft", "order-127"),
  specimenEvent(3, "recommendation", "agent", "Recoverable $72,200: won, never billed", null),
  specimenEvent(
    4,
    "approval_pending",
    "agent",
    "R-10 warns: contract-4 In Approval Process: human approval required",
    "contract-4",
  ),
];
const SCRIPT_SYSTEMS: EraSystem[][] = [
  ["salesforce"],
  ["salesforce"],
  ["salesforce", "google-drive"],
  ["salesforce", "google-drive", "slack"],
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-border py-10 first:border-t-0 first:pt-0">
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function StyleGuide() {
  const [step, setStep] = useState(0);
  const events = SCRIPT.slice(0, step);
  const active = step > 0 ? (SCRIPT_SYSTEMS[step - 1] ?? []) : [];

  return (
    <div>
      <PageHeader
        eyebrow="Ghost · Design system"
        title="Interface kit"
        description="Tokens, primitives and agent components. Specimens use the Tidewater Capital hero case, so every figure here is a real record."
        actions={<FixtureBadge />}
      />

      <Section
        id="identity"
        title="Voice"
        description="Fraunces for rare editorial moments, Geist for the interface, Geist Mono for ids and logs."
      >
        <Panel tone="forest" className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <p className="max-w-xl font-display text-4xl leading-tight text-petal md:text-5xl">
            Find the revenue you already earned.
          </p>
          <div className="space-y-1 text-right">
            <Money cents={7_220_000} size="display" tone="petal" />
            <p className="font-mono text-xs text-fg-subtle">acct-6 · Tidewater Capital</p>
          </div>
        </Panel>
      </Section>

      <Section
        id="colour"
        title="Colour"
        description="Pink is the agent and what it finds. Blue is connection. Lemon is high value. Lime is recovered."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {SWATCHES.map(([token, cls, name]) => (
            <div key={token} className="overflow-hidden rounded-card border border-border bg-surface">
              <div className={`h-16 ${cls}`} />
              <div className="px-3 py-2">
                <p className="text-xs font-medium">{name}</p>
                <p className="font-mono text-2xs text-fg-subtle">--color-{token}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="actions" title="Actions & status">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Approve &amp; create Stripe invoice</Button>
            <Button variant="accent" icon={<FileSearch aria-hidden />}>
              Investigate
            </Button>
            <Button variant="secondary">Refresh from Stripe</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger">Reject</Button>
            <Button loading>Creating invoice</Button>
            <Button size="sm" variant="secondary">
              Small
            </Button>
            <Tooltip content="Every action is written to the audit trail">
              <Button size="icon" variant="secondary" aria-label="Replay">
                <RotateCw aria-hidden />
              </Button>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-2">
            {FINDING_STATUSES.map((s) => (
              <StatusPill key={s} status={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {OTHER_STATUSES.map((s) => (
              <StatusPill key={s} status={s} size="sm" />
            ))}
            <Badge tone="forest">Agent</Badge>
            <FixtureBadge />
          </div>
        </div>
      </Section>

      <Section
        id="sources"
        title="Sources"
        description="Seven Era systems as two-tone tiles. Every claim cites a record; chips open the record drawer."
      >
        <div className="flex flex-wrap items-center gap-4">
          {ERA_SYSTEMS.map((s) => (
            <SystemIcon key={s} system={s} size="md" showLabel />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <SourceChip
            system="salesforce"
            externalId="deal-127"
            title="Tidewater Capital deal"
            recordType="Opportunity"
            quote="Closed Won, $51,500"
          />
          <SourceChip
            system="salesforce"
            externalId="contract-4"
            title="Business plan for Tidewater Capital"
            recordType="Contract"
            quote="Business plan for Tidewater Capital: 20 seats at 9,700 per year. Status: In Approval Process"
          />
          <SourceChip system="salesforce" externalId="order-127" title="Order" recordType="Order" compact />
          <MonoId value="oli-deal-127-1" />
        </div>
      </Section>

      <Section
        id="agent"
        title="Agent"
        description="The activity stream is the audit feed. Step through to see nodes activate and trails draw."
      >
        <Panel tone="forest" className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-medium text-petal">Ghost is working</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setStep(0)} disabled={step === 0}>
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="inverse"
                  icon={<Play aria-hidden />}
                  onClick={() => setStep((s) => Math.min(SCRIPT.length, s + 1))}
                  disabled={step === SCRIPT.length}
                >
                  Next step
                </Button>
              </div>
            </div>
            <ActivityStream events={events} emptyLabel="Press “Next step” to replay the investigation." />
          </div>
          <div className="lg:col-span-3">
            <EvidenceGraph customerName="Tidewater Capital" activeSystems={active} />
          </div>
        </Panel>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Workflow steps">
            <ol>
              <AgentStep state="done" title="Load customer facts" detail="3 Closed Won deals, 3 Draft orders" />
              <AgentStep state="done" title="Gather evidence" detail="Opportunities, line items, contract-4, orders" />
              <AgentStep state="active" title="Evaluate eligibility R-01..R-10" />
              <AgentStep state="pending" title="Explain with citations" last />
            </ol>
          </Card>
          <Card title="Eligibility">
            <div className="space-y-1">
              <RuleRow check={R04} />
              <RuleRow check={R10} />
              <RuleRow check={R06} />
            </div>
          </Card>
        </div>
      </Section>

      <Section id="data" title="Data">
        <div className="grid gap-6 lg:grid-cols-5">
          <Card
            flush
            className="lg:col-span-3"
            title="Calculation"
            description="Σ closed-won line items without activated order or invoice"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead numeric>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TIDEWATER_LINES.map((l) => (
                  <TableRow key={l.line}>
                    <TableCell>
                      <MonoId value={l.deal} copyable={false} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-fg-muted">{l.line}</TableCell>
                    <TableCell numeric>
                      <Money cents={l.cents} format="full" />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow highlight="lemon">
                  <TableCell colSpan={2} className="font-medium">
                    Total recoverable
                  </TableCell>
                  <TableCell numeric>
                    <Money cents={7_220_000} format="full" size="md" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
          <Card className="lg:col-span-2" title="Record facts">
            <KeyValue
              items={[
                { label: "Customer", value: "Tidewater Capital" },
                { label: "Era account", value: "acct-6", mono: true },
                { label: "Contract", value: "In Approval Process" },
                { label: "Orders", value: "3 × Draft" },
              ]}
            />
          </Card>
        </div>
        <Tabs defaultValue="commercial" className="mt-6">
          <TabsList>
            <TabsTrigger value="commercial">Commercial</TabsTrigger>
            <TabsTrigger value="invoices" count={0}>
              Invoices
            </TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
          </TabsList>
          <TabsContent value="commercial">
            <Tabs defaultValue="ready">
              <TabsList variant="pill">
                <TabsTrigger value="ready">Ready</TabsTrigger>
                <TabsTrigger value="review">Needs review</TabsTrigger>
                <TabsTrigger value="recovered">Recovered</TabsTrigger>
              </TabsList>
            </Tabs>
          </TabsContent>
          <TabsContent value="invoices">
            <EmptyState
              size="sm"
              icon={<FileSearch aria-hidden />}
              title="No invoices yet"
              description="Invoices appear after a human approves a finding."
            />
          </TabsContent>
          <TabsContent value="context">
            <Skeleton lines={3} className="max-w-md" />
          </TabsContent>
        </Tabs>
      </Section>

      <Section id="states" title="States" description="Every screen ships loading, empty, error and success.">
        <div className="grid gap-6 md:grid-cols-3">
          <Card title="Loading">
            <div className="space-y-3">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton lines={3} />
            </div>
          </Card>
          <Card>
            <EmptyState
              size="sm"
              icon={<FileSearch aria-hidden />}
              title="No leaks found"
              description="Sync company data, then hunt for leaks."
            />
          </Card>
          <Card>
            <ErrorState
              size="sm"
              title="Couldn’t reach Stripe"
              message="Request timed out after 15s."
              onRetry={() => undefined}
            />
          </Card>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="mt-6" variant="secondary">
              Open approval dialog
            </Button>
          </DialogTrigger>
          <DialogContent
            eyebrow="Human approval"
            title="Create Stripe invoice for Tidewater Capital?"
            description="Ghost will create and finalize a test-mode invoice."
          >
            <div className="flex items-baseline justify-between rounded-card bg-surface-muted px-4 py-3">
              <span className="text-sm text-fg-muted">Amount</span>
              <Money cents={7_220_000} size="lg" />
            </div>
            <RuleRow check={R10} className="mt-3" />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>Approve</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>
    </div>
  );
}
