import { cn } from "../../lib/cn";

/** Evidence score 0–100 as a compact meter. Lemon marks strong cases: high-value, well-evidenced. */
export function EvidenceScoreBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const tone = pct >= 75 ? "bg-lemon" : pct >= 50 ? "bg-signal" : "bg-punch";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-border"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Evidence score ${pct} of 100`}
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-fg-muted">{pct}</span>
    </div>
  );
}
