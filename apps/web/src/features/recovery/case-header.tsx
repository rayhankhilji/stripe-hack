import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { FindingDetailDTO } from "@ghost/shared";
import { Money } from "../../components/ghost/money";
import { StatusPill } from "../../components/ghost/status-pill";
import { FixtureBadge } from "../../components/ghost/fixture-badge";
import { verdict } from "./case-model";

export function CaseHeader({ finding }: { finding: FindingDetailDTO }) {
  const sentence = verdict(finding);
  return (
    <header className="flex flex-col gap-5">
      <Link
        href="/recovery"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink/60 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-punch"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Recovery queue
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={`/customers/${finding.customerId}`}
              className="font-medium text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-punch"
            >
              {finding.customerName}
            </Link>
            <StatusPill status={finding.status} />
            {finding.isFixture ? <FixtureBadge /> : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{finding.title}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-ink/50">Recoverable</span>
          <Money cents={finding.amountCents} size="xl" />
        </div>
      </div>
      {sentence ? (
        <p className="max-w-3xl border-l-2 border-petal pl-4 text-base leading-relaxed text-ink/80">{sentence}</p>
      ) : null}
    </header>
  );
}
