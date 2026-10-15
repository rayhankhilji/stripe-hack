import type { CustomerDetailDTO } from "@ghost/shared";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { FixtureBadge } from "../../components/ghost/fixture-badge";
import { SourceChip } from "../../components/ghost/source-chip";
import { DataTable, type Column } from "./data-table";

type Source = CustomerDetailDTO["recentSources"][number];

const COLUMNS: Column<Source>[] = [
  { key: "source", header: "Record", cell: (s) => <SourceChip system={s.system} externalId={s.externalId} title={s.title} /> },
  { key: "type", header: "Type", cell: (s) => <span className="font-mono text-xs">{s.recordType}</span> },
  { key: "when", header: "Occurred", cell: (s) => s.occurredAt ?? <span className="text-ink/50">—</span> },
  { key: "fixture", header: "", cell: (s) => (s.isFixture ? <FixtureBadge /> : null) },
];

export function SourcesTab({ customer }: { customer: CustomerDetailDTO }) {
  return (
    <Card className="overflow-hidden p-0">
      {customer.recentSources.length === 0 ? (
        <EmptyState title="No source records" description="Sync company data to pull records for this customer." />
      ) : (
        <DataTable columns={COLUMNS} rows={customer.recentSources} rowKey={(s) => `${s.system}:${s.externalId}`} caption="Recent source records" />
      )}
    </Card>
  );
}
