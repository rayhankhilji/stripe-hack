import type { CustomerDetailDTO } from "@ghost/shared";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Money } from "../../components/ghost/money";
import { MonoId } from "../../components/ghost/mono-id";
import { DataTable, type Column } from "./data-table";

type Deal = CustomerDetailDTO["deals"][number];
type Contract = CustomerDetailDTO["contracts"][number];
type Order = CustomerDetailDTO["orders"][number];

const dash = <span className="text-ink/50">—</span>;

const DEAL_COLUMNS: Column<Deal>[] = [
  { key: "id", header: "Deal", cell: (d) => <MonoId value={d.externalId} /> },
  { key: "name", header: "Name", cell: (d) => d.name },
  { key: "stage", header: "Stage", cell: (d) => d.stage },
  { key: "close", header: "Close date", cell: (d) => d.closeDate ?? dash },
  { key: "amount", header: "Amount", align: "right", cell: (d) => (d.amountCents === null ? dash : <Money cents={d.amountCents} />) },
];

const CONTRACT_COLUMNS: Column<Contract>[] = [
  { key: "id", header: "Contract", cell: (c) => <MonoId value={c.externalId} /> },
  { key: "status", header: "Status", cell: (c) => c.status },
  { key: "period", header: "Period", cell: (c) => (c.startDate || c.endDate ? `${c.startDate ?? "?"} → ${c.endDate ?? "?"}` : dash) },
  { key: "terms", header: "Terms", cell: (c) => <span className="text-ink/80">{[c.description, c.specialTerms].filter(Boolean).join(" ") || dash}</span> },
];

const ORDER_COLUMNS: Column<Order>[] = [
  { key: "id", header: "Order", cell: (o) => <MonoId value={o.externalId} /> },
  { key: "status", header: "Status", cell: (o) => <span className={o.status === "Draft" ? "font-medium" : undefined}>{o.status}</span> },
  { key: "deal", header: "Deal", cell: (o) => (o.dealExternalId ? <MonoId value={o.dealExternalId} /> : dash) },
  { key: "effective", header: "Effective", cell: (o) => o.effectiveDate ?? dash },
  { key: "total", header: "Total", align: "right", cell: (o) => (o.totalCents === null ? dash : <Money cents={o.totalCents} />) },
];

function Section<T>({ title, empty, columns, rows, rowKey, rowClassName }: {
  title: string;
  empty: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  rowClassName?: (r: T) => string | undefined;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <EmptyState title={empty} />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={rowKey} rowClassName={rowClassName} caption={title} />
        )}
      </Card>
    </section>
  );
}

export function CommercialTab({ customer }: { customer: CustomerDetailDTO }) {
  return (
    <div className="space-y-6">
      <Section title="Deals" empty="No deals on record" columns={DEAL_COLUMNS} rows={customer.deals} rowKey={(d) => d.externalId} />
      <Section title="Contracts" empty="No contracts on record" columns={CONTRACT_COLUMNS} rows={customer.contracts} rowKey={(c) => c.externalId} />
      <Section
        title="Orders"
        empty="No orders on record"
        columns={ORDER_COLUMNS}
        rows={customer.orders}
        rowKey={(o) => o.externalId}
        rowClassName={(o) => (o.status === "Draft" ? "bg-lemon/30" : undefined)}
      />
    </div>
  );
}
