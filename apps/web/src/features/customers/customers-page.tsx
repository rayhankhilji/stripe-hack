"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import type { CustomerSummaryDTO } from "@ghost/shared";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { Skeleton } from "../../components/ui/skeleton";
import { Money } from "../../components/ghost/money";
import { PageHeader } from "../../components/ghost/page-header";
import { SystemIcon } from "../../components/ghost/system-icon";
import { useCustomers } from "../../lib/queries/customers";
import { DataTable, type Column } from "./data-table";
import { useDebounced } from "./use-debounced";

const COLUMNS: Column<CustomerSummaryDTO>[] = [
  {
    key: "name",
    header: "Customer",
    cell: (c) => (
      <Link href={`/customers/${c.id}`} className="font-medium text-ink hover:underline">
        {c.name}
        <span className="block font-mono text-xs font-normal text-ink/60">{c.eraAccountId}</span>
      </Link>
    ),
  },
  { key: "tier", header: "Tier", cell: (c) => (c.tier ? <Badge>{c.tier}</Badge> : <span className="text-ink/50">—</span>) },
  { key: "status", header: "Status", cell: (c) => <span className="capitalize">{c.status}</span> },
  { key: "arr", header: "ARR", align: "right", cell: (c) => (c.arrCents === null ? <span className="text-ink/50">—</span> : <Money cents={c.arrCents} />) },
  {
    key: "open",
    header: "Open recoverable",
    align: "right",
    cell: (c) =>
      c.openFindingsCents > 0 ? (
        <span className="inline-flex rounded-md bg-lemon/40 px-2 py-0.5">
          <Money cents={c.openFindingsCents} />
        </span>
      ) : (
        <span className="text-ink/50">—</span>
      ),
  },
  {
    key: "systems",
    header: "Systems",
    cell: (c) => (
      <span className="flex items-center gap-1">
        {c.systems.map((s) => (
          <SystemIcon key={s} system={s} />
        ))}
      </span>
    ),
  },
];

function ListSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading customers">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function CustomersPage() {
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 250);
  const query = useCustomers(term);
  const rows = query.data ?? [];

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Customers" description="Every account Ghost has resolved across your connected systems." />
      <label className="relative block max-w-md">
        <span className="sr-only">Search customers</span>
        <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/50" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name"
          className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
      </label>
      <Card className="overflow-hidden p-0">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={term ? `No customers match “${term}”` : "No customers yet"}
            description={term ? "Try a different name." : "Sync company data from the workspace to resolve customers."}
          />
        ) : (
          <DataTable columns={COLUMNS} rows={rows} rowKey={(c) => c.id} caption="Customers" />
        )}
      </Card>
    </div>
  );
}
