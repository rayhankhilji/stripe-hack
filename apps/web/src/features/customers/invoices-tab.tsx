import type { CustomerDetailDTO, InvoiceDTO } from "@ghost/shared";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Money } from "../../components/ghost/money";
import { MonoId } from "../../components/ghost/mono-id";
import { StatusPill } from "../../components/ghost/status-pill";
import { DataTable, type Column } from "./data-table";

const COLUMNS: Column<InvoiceDTO>[] = [
  { key: "number", header: "Invoice", cell: (i) => (i.number ? <span className="font-mono text-xs">{i.number}</span> : <MonoId value={i.stripeInvoiceId} />) },
  { key: "status", header: "Status", cell: (i) => <StatusPill status={i.status} /> },
  { key: "due", header: "Due", cell: (i) => i.dueDate ?? <span className="text-ink/50">—</span> },
  { key: "paid", header: "Paid", cell: (i) => i.paidAt ?? <span className="text-ink/50">—</span> },
  { key: "amount", header: "Amount due", align: "right", cell: (i) => <Money cents={i.amountDueCents} /> },
  {
    key: "link",
    header: "Stripe",
    cell: (i) =>
      i.hostedInvoiceUrl ? (
        <a href={i.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-signal hover:underline">
          Payment page
        </a>
      ) : (
        <span className="text-ink/50">—</span>
      ),
  },
];

export function InvoicesTab({ customer }: { customer: CustomerDetailDTO }) {
  return (
    <Card className="overflow-hidden p-0">
      {customer.invoices.length === 0 ? (
        <EmptyState title="No invoices yet" description="Invoices appear here once a recovered finding is approved and billed." />
      ) : (
        <DataTable columns={COLUMNS} rows={customer.invoices} rowKey={(i) => i.id} caption="Invoices" />
      )}
    </Card>
  );
}
