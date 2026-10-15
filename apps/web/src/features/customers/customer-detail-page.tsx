"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { Card } from "../../components/ui/card";
import { ErrorState } from "../../components/ui/error-state";
import { Skeleton } from "../../components/ui/skeleton";
import { useCustomer } from "../../lib/queries/customers";
import { CommercialTab } from "./commercial-tab";
import { ContextTab } from "./context-tab";
import { CustomerHeader } from "./customer-header";
import { FindingsTab } from "./findings-tab";
import { InvoicesTab } from "./invoices-tab";
import { SourcesTab } from "./sources-tab";

const TABS = [
  { value: "commercial", label: "Commercial" },
  { value: "invoices", label: "Invoices" },
  { value: "findings", label: "Findings" },
  { value: "context", label: "Context" },
  { value: "sources", label: "Sources" },
] as const;

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading customer">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function CustomerDetailPage({ id }: { id: string }) {
  const query = useCustomer(id);
  const customer = query.data;

  return (
    <div className="space-y-6 p-8">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-ink/70 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Customers
      </Link>
      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError || !customer ? (
        <Card>
          <ErrorState message={query.error?.message ?? "Customer not found"} onRetry={() => void query.refetch()} />
        </Card>
      ) : (
        <>
          <CustomerHeader customer={customer} />
          <Tabs.Root defaultValue="commercial" className="space-y-4">
            <Tabs.List aria-label="Customer sections" className="flex gap-1 border-b border-line">
              {TABS.map((t) => (
                <Tabs.Trigger
                  key={t.value}
                  value={t.value}
                  className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-ink/60 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-signal data-[state=active]:border-punch data-[state=active]:text-ink"
                >
                  {t.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content value="commercial" className="outline-none">
              <CommercialTab customer={customer} />
            </Tabs.Content>
            <Tabs.Content value="invoices" className="outline-none">
              <InvoicesTab customer={customer} />
            </Tabs.Content>
            <Tabs.Content value="findings" className="outline-none">
              <FindingsTab customer={customer} />
            </Tabs.Content>
            <Tabs.Content value="context" className="outline-none">
              <ContextTab customerId={customer.id} customerName={customer.name} knownSources={customer.recentSources} />
            </Tabs.Content>
            <Tabs.Content value="sources" className="outline-none">
              <SourcesTab customer={customer} />
            </Tabs.Content>
          </Tabs.Root>
        </>
      )}
    </div>
  );
}
