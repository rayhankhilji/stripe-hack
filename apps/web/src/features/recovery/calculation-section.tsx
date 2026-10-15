import type { FindingDetailDTO } from "@ghost/shared";
import { Money } from "../../components/ghost/money";
import { MonoId } from "../../components/ghost/mono-id";
import { CaseSection } from "./case-section";
import { shortHash } from "./case-model";

export function CalculationSection({ finding }: { finding: FindingDetailDTO }) {
  const calc = finding.calculation;
  return (
    <CaseSection id="calculation" title="Calculation" aside={<span className="font-mono">{calc.formula}</span>}>
      {calc.inputs.length > 0 ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {calc.inputs.map((input, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
              <dt className="text-ink/60">{input.label}</dt>
              <dd className="flex items-baseline gap-2 text-right">
                <span className="font-medium tabular-nums text-ink">{input.value}</span>
                {input.sourceExternalId ? <MonoId value={input.sourceExternalId} /> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-ink/50">
            <th className="pb-2 font-medium">Line</th>
            <th className="pb-2 font-medium">Deal</th>
            <th className="pb-2 text-right font-medium">Qty</th>
            <th className="pb-2 text-right font-medium">Unit</th>
            <th className="pb-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {finding.lines.map((l) => (
            <tr key={l.id}>
              <td className="py-2 pr-3 text-ink">{l.description}</td>
              <td className="py-2 pr-3">{l.dealExternalId ? <MonoId value={l.dealExternalId} /> : "—"}</td>
              <td className="py-2 text-right tabular-nums">{l.quantity}</td>
              <td className="py-2 text-right">
                <Money cents={l.unitAmountCents} size="sm" />
              </td>
              <td className="py-2 text-right">
                <Money cents={l.amountCents} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {calc.steps.length > 0 ? (
        <ol className="flex flex-col gap-1.5 rounded-2xl bg-porcelain p-4 text-sm">
          {calc.steps.map((s, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-ink/70">
                <span className="mr-2 font-mono text-xs text-ink/40">{i + 1}</span>
                {s.label}
              </span>
              <Money cents={s.amountCents} size="sm" />
            </li>
          ))}
          <li className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2">
            <span className="font-semibold text-ink">Total</span>
            <Money cents={calc.totalCents} size="md" />
          </li>
        </ol>
      ) : null}

      <p className="font-mono text-xs text-ink/50">
        Computed deterministically · {calc.version} · hash {shortHash(calc.calcHash)}
      </p>
    </CaseSection>
  );
}
