import { Check, CircleDashed, Clock, FileEdit, Flag } from "lucide-react";
import type { SequenceStep, StepState } from "./sequence";
import { cn } from "../../lib/cn";

const NODE: Record<StepState, string> = {
  done: "bg-lime text-forest",
  current: "bg-petal text-forest ring-2 ring-punch",
  upcoming: "bg-white text-ink/60 border border-line",
  drafted: "bg-lemon text-forest",
  suppressed: "bg-porcelain text-ink/50 border border-line",
  unscheduled: "bg-porcelain text-ink/40 border border-dashed border-line",
};

function NodeIcon({ state }: { state: StepState }) {
  if (state === "done") return <Check aria-hidden className="size-4" />;
  if (state === "drafted") return <FileEdit aria-hidden className="size-4" />;
  if (state === "current") return <Flag aria-hidden className="size-4" />;
  if (state === "unscheduled") return <CircleDashed aria-hidden className="size-4" />;
  return <Clock aria-hidden className="size-4" />;
}

export function SequenceTrack({ steps }: { steps: SequenceStep[] }) {
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Collection sequence">
      {steps.map((step, i) => {
        const suppressed = step.state === "suppressed";
        return (
          <li key={step.key} className="relative flex min-w-0 flex-col items-start gap-2">
            {i > 0 && (
              <span
                aria-hidden
                className={cn("absolute -left-1/2 top-4 h-px w-full", suppressed ? "bg-line" : "bg-forest-2/30")}
              />
            )}
            <span className={cn("relative z-10 grid size-8 place-items-center rounded-full", NODE[step.state])}>
              <NodeIcon state={step.state} />
            </span>
            <div className="min-w-0">
              <p className={cn("text-sm font-medium text-ink", suppressed && "text-ink/50 line-through")}>{step.label}</p>
              <p className={cn("text-xs text-ink/60", suppressed && "not-italic text-ink/60")}>{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
