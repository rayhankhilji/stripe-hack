import Link from "next/link";
import { Mail, ScanSearch } from "lucide-react";
import type { ExpansionDTO } from "@ghost/shared";
import { Panel } from "../../components/ui/panel";
import { Button } from "../../components/ui/button";
import { SourceChip } from "../../components/ghost/source-chip";
import { cn } from "../../lib/cn";

type Props = { item: ExpansionDTO; onScan: () => void; scanning: boolean };

function DraftAction({ item, onScan, scanning }: Props) {
  if (item.draftMessageId) {
    return (
      <Link href={`/outbox?m=${item.draftMessageId}`} className="contents">
        <Button variant="primary" size="sm">
          <Mail aria-hidden className="size-4" /> Review draft in outbox
        </Button>
      </Link>
    );
  }
  return (
    <Button variant="secondary" size="sm" onClick={onScan} disabled={scanning}>
      <ScanSearch aria-hidden className="size-4" /> {scanning ? "Scanning…" : "Rescan to draft email"}
    </Button>
  );
}

export function ExpansionCard(props: Props) {
  const { item } = props;
  const clear = item.existingOpenDeals === 0;
  return (
    <Panel className="flex flex-col gap-4 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/60">{item.customerName}</p>
          <h2 className="text-base font-semibold text-ink">{item.title}</h2>
        </div>
        <div className="flex flex-col items-end" aria-label={`Signal score ${item.signalScore} of 100`}>
          <span className="rounded-full bg-lemon px-3 py-1 text-sm font-semibold tabular-nums text-forest">{item.signalScore}</span>
          <span className="mt-1 text-xs text-ink/60">signal score</span>
        </div>
      </header>

      <p className="text-sm leading-relaxed text-ink/80">{item.rationale}</p>

      <p
        className={cn(
          "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
          clear ? "bg-lime text-forest" : "bg-petal text-forest",
        )}
      >
        Existing open deals: {item.existingOpenDeals}
      </p>

      {item.evidence.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.evidence.map((e) => (
            <SourceChip key={e.id} system={e.source.system} externalId={e.source.externalId} title={e.source.title} />
          ))}
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-line pt-4">
        <span className="text-xs capitalize text-ink/60">{item.status.replaceAll("_", " ")}</span>
        <DraftAction {...props} />
      </footer>
    </Panel>
  );
}
