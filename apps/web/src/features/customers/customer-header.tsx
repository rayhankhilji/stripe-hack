import type { CustomerDetailDTO } from "@ghost/shared";
import { Badge } from "../../components/ui/badge";
import { Money } from "../../components/ghost/money";
import { SystemIcon } from "../../components/ghost/system-icon";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink/60">{label}</dt>
      <dd className="mt-1 text-base font-medium text-ink">{children}</dd>
    </div>
  );
}

export function CustomerHeader({ customer }: { customer: CustomerDetailDTO }) {
  return (
    <header className="space-y-5 rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink">{customer.name}</h1>
        {customer.tier ? <Badge>{customer.tier}</Badge> : null}
        <span className="text-sm capitalize text-ink/70">{customer.status}</span>
        {customer.domain ? <span className="font-mono text-xs text-ink/60">{customer.domain}</span> : null}
      </div>
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="ARR">{customer.arrCents === null ? "—" : <Money cents={customer.arrCents} />}</Stat>
        <Stat label="Open recoverable">
          {customer.openFindingsCents > 0 ? (
            <span className="rounded-md bg-lemon/40 px-2 py-0.5">
              <Money cents={customer.openFindingsCents} />
            </span>
          ) : (
            "—"
          )}
        </Stat>
        <Stat label="Licensed seats">{customer.licensedSeats ?? "—"}</Stat>
        <Stat label="Renewal">{customer.renewalDate ?? "—"}</Stat>
      </dl>
      <div>
        <h2 className="mb-2 text-xs uppercase tracking-wide text-ink/60">Identity across systems</h2>
        <ul className="flex flex-wrap gap-2">
          {customer.identities.map((i) => (
            <li
              key={`${i.system}:${i.externalId}`}
              title={`Matched by ${i.matchMethod}`}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-porcelain py-1 pl-1 pr-3"
            >
              <SystemIcon system={i.system} />
              <span className="font-mono text-xs text-ink">
                {i.system}:{i.externalId}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
