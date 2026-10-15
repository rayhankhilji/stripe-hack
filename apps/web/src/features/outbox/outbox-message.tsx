import { Check, X } from "lucide-react";
import type { OutboxMessageDTO } from "@ghost/shared";
import { Panel } from "../../components/ui/panel";
import { Button } from "../../components/ui/button";
import { StatusPill } from "../../components/ghost/status-pill";

type Props = {
  message: OutboxMessageDTO;
  onDecide: (decision: "approve" | "reject") => void;
  deciding: boolean;
};

const KIND_LABEL: Record<OutboxMessageDTO["kind"], string> = {
  collection_reminder: "Collection reminder",
  expansion_email: "Expansion email",
};

export function OutboxMessage({ message, onDecide, deciding }: Props) {
  const pending = message.status === "pending_approval";
  return (
    <Panel className="flex flex-col gap-5 p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/60">{KIND_LABEL[message.kind]}</p>
          <h2 className="text-base font-semibold text-ink">{message.subject}</h2>
        </div>
        <StatusPill status={message.status} />
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink/60">To</dt>
        <dd className="flex flex-wrap items-baseline gap-2 font-mono">
          <span className="text-ink">{message.toAddress}</span>
          {message.originalRecipient && (
            <s className="text-xs text-ink/50" title="Original recipient, never contacted">
              {message.originalRecipient}
            </s>
          )}
        </dd>
        <dt className="text-ink/60">Created</dt>
        <dd className="text-ink">{message.createdAt}</dd>
        {message.decidedAt && (
          <>
            <dt className="text-ink/60">Decided</dt>
            <dd className="text-ink">{message.decidedAt}</dd>
          </>
        )}
      </dl>

      <article className="whitespace-pre-wrap rounded-lg border border-line bg-porcelain p-4 text-sm leading-relaxed text-ink">
        {message.bodyMd}
      </article>

      {pending && (
        <footer className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" size="sm" disabled={deciding} onClick={() => onDecide("reject")}>
            <X aria-hidden className="size-4" /> Reject
          </Button>
          <Button variant="primary" size="sm" disabled={deciding} onClick={() => onDecide("approve")}>
            <Check aria-hidden className="size-4" /> Approve (sandbox send)
          </Button>
        </footer>
      )}
    </Panel>
  );
}
