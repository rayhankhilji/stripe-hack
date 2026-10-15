import { BadgeCheck, CircleAlert } from "lucide-react";
import type { FindingDetailDTO } from "@ghost/shared";
import { SourceChip } from "../../components/ghost/source-chip";
import { cn } from "../../lib/cn";
import { CaseSection } from "./case-section";
import { EVIDENCE_ROLE_LABEL, evidenceAnchor, groupEvidence } from "./case-model";

export function EvidenceSection({ finding, highlighted }: { finding: FindingDetailDTO; highlighted: string | null }) {
  const groups = groupEvidence(finding.evidence);
  const verified = finding.evidence.filter((e) => e.verified).length;
  return (
    <CaseSection
      id="evidence"
      title="Evidence"
      aside={`${verified} of ${finding.evidence.length} quotes verified verbatim in source`}
    >
      {groups.length === 0 ? (
        <p className="text-sm text-fg-subtle">No evidence has been gathered for this case.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.role} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
                {EVIDENCE_ROLE_LABEL[g.role]} · {g.items.length}
              </h3>
              <ul className="flex flex-col gap-2">
                {g.items.map((e) => (
                  <li
                    key={e.id}
                    id={evidenceAnchor(e.id)}
                    className={cn(
                      "scroll-mt-24 rounded-card border border-border p-3 transition-colors duration-300",
                      highlighted === e.id ? "border-petal bg-petal/20" : "bg-surface",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <SourceChip source={e.source} />
                      {e.verified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-lime-deep dark:text-lime">
                          <BadgeCheck className="size-3.5" aria-hidden /> verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-punch">
                          <CircleAlert className="size-3.5" aria-hidden /> not found verbatim
                        </span>
                      )}
                    </div>
                    <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm leading-relaxed text-fg-muted">
                      {e.quote}
                    </blockquote>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </CaseSection>
  );
}
