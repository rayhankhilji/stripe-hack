import Link from "next/link";
import type { CustomerDetailDTO, FindingSummaryDTO } from "@ghost/shared";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { FixtureBadge } from "../../components/ghost/fixture-badge";
import { Money } from "../../components/ghost/money";
import { StatusPill } from "../../components/ghost/status-pill";
import { DataTable, type Column } from "./data-table";

const COLUMNS: Column<FindingSummaryDTO>[] = [
  {
    key: "title",
    header: "Finding",
    cell: (f) => (
      <span className="flex items-center gap-2">
        <Link href={`/recovery/${f.id}`} className="font-medium hover:underline">
          {f.title}
        </Link>
        {f.isFixture ? <FixtureBadge /> : null}
      </span>
    ),
  },
  { key: "status", header: "Status", cell: (f) => <StatusPill status={f.status} /> },
  { key: "score", header: "Evidence", cell: (f) => <span className="tabular-nums">{f.evidenceScore}/100 · {f.evidenceCount}</span> },
  { key: "rules", header: "Failing rules", cell: (f) => (f.failingRules.length ? <span className="font-mono text-xs">{f.failingRules.join(", ")}</span> : <span className="text-ink/50">—</span>) },
  { key: "amount", header: "Amount", align: "right", cell: (f) => <Money cents={f.amountCents} /> },
];

export function FindingsTab({ customer }: { customer: CustomerDetailDTO }) {
  return (
    <Card className="overflow-hidden p-0">
      {customer.findings.length === 0 ? (
        <EmptyState title="No findings for this customer" description="Run “Hunt for leaks” from the workspace to check for unbilled revenue." />
      ) : (
        <DataTable columns={COLUMNS} rows={customer.findings} rowKey={(f) => f.id} caption="Findings" />
      )}
    </Card>
  );
}
