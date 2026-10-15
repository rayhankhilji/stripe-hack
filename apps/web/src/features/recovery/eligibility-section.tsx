import type { FindingDetailDTO } from "@ghost/shared";
import { RuleRow } from "../../components/ghost/rule-row";
import { CaseSection } from "./case-section";

export function EligibilitySection({ finding }: { finding: FindingDetailDTO }) {
  const checks = finding.eligibility;
  const count = (o: "pass" | "warn" | "fail") => checks.filter((c) => c.outcome === o).length;
  return (
    <CaseSection
      id="eligibility"
      title="Eligibility checks"
      aside={checks.length ? `${count("pass")} pass · ${count("warn")} warn · ${count("fail")} fail` : undefined}
    >
      {checks.length === 0 ? (
        <p className="text-sm text-fg-subtle">Checks run when Ghost investigates the case.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {checks.map((c) => (
            <RuleRow key={c.ruleId} check={c} />
          ))}
        </div>
      )}
    </CaseSection>
  );
}
