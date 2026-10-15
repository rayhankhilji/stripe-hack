"use client";

import type { OverviewDTO } from "@ghost/shared";
import { CircleCheck, Hourglass, Search } from "lucide-react";
import { KpiTile } from "./kpi-tile";

function count(byStatus: OverviewDTO["findingsByStatus"], ...statuses: string[]): number {
  return statuses.reduce((n, s) => n + (byStatus[s] ?? 0), 0);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function KpiTiles({ overview }: { overview: OverviewDTO }) {
  const s = overview.findingsByStatus;
  const open = count(s, "detected", "analyzing", "needs_review", "escalated", "ready_for_approval", "approved", "failed");
  const awaiting = count(s, "invoiced");
  const recovered = count(s, "recovered");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
      <KpiTile
        label="Recoverable"
        cents={overview.recoverableCents}
        hint={plural(open, "open case", "open cases")}
        accent="lemon"
        icon={Search}
      />
      <KpiTile
        label="Awaiting payment"
        cents={overview.awaitingPaymentCents}
        hint={plural(awaiting, "invoice open", "invoices open")}
        accent="signal"
        icon={Hourglass}
      />
      <KpiTile
        label="Recovered"
        cents={overview.recoveredCents}
        hint={recovered > 0 ? `${plural(recovered, "case", "cases")} · webhook verified` : "Verified by Stripe webhook"}
        accent="lime"
        icon={CircleCheck}
      />
    </div>
  );
}
