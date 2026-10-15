import { FlaskConical } from "lucide-react";
import { cn } from "../../lib/cn";

/** Required on any synthetic record (`isFixture`): INSTRUCTIONS §9. */
export function FixtureBadge({ className }: { className?: string }) {
  return (
    <span
      title="Synthetic demo data recorded from Era"
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md border border-dashed border-lemon-deep/40 bg-lemon-soft px-1.5 font-mono text-2xs font-medium uppercase tracking-wider text-lemon-deep dark:border-lemon/40 dark:bg-lemon/10 dark:text-lemon",
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
      Demo fixture
    </span>
  );
}
