import type { ReactNode } from "react";
import { Card } from "../../components/ui/card";

/** One titled block of the case view. Keeps section rhythm identical across the page. */
export function CaseSection({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id={`${id}-title`} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {aside ? <div className="text-xs text-ink/60">{aside}</div> : null}
        </div>
        {children}
      </Card>
    </section>
  );
}
