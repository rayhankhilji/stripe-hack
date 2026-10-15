import type { ReactNode } from "react";
import { Card } from "../../components/ui/card";

type Props = { title: string; action?: ReactNode; children: ReactNode };

/** Quiet white card with a compact header row, used by every right-column block. */
export function SectionCard({ title, action, children }: Props) {
  return (
    <Card className="overflow-hidden p-0">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {action}
      </header>
      {children}
    </Card>
  );
}
