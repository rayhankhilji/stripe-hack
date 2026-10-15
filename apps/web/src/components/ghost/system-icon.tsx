import type { EraSystem } from "@ghost/shared";
import { AudioLines, Cloud, Database, FileText, LifeBuoy, MessagesSquare, SquareKanban, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { systemLabel } from "../../lib/format/systems";

type Tile = { icon: LucideIcon; tile: string };

// Two-tone colour tiles: a solid brand colour carrying a single glyph in a deeper partner colour.
const TILES: Record<EraSystem, Tile> = {
  salesforce: { icon: Cloud, tile: "bg-signal text-navy" },
  "google-drive": { icon: FileText, tile: "bg-lemon text-forest" },
  slack: { icon: MessagesSquare, tile: "bg-petal text-punch-deep" },
  gong: { icon: AudioLines, tile: "bg-navy text-petal" },
  "jira-confluence": { icon: SquareKanban, tile: "bg-signal-soft text-navy" },
  zendesk: { icon: LifeBuoy, tile: "bg-lime text-forest" },
  aws: { icon: Database, tile: "bg-forest-2 text-lime" },
};

export function systemTile(system: EraSystem): Tile {
  return TILES[system];
}

export type SystemIconProps = {
  system: EraSystem;
  size?: "xs" | "sm" | "md" | "lg";
  /** Render the label next to the tile. */
  showLabel?: boolean;
  /** Dim the tile (e.g. system not resolved for this customer). */
  inactive?: boolean;
  className?: string;
};

const SIZES = {
  xs: "size-5 rounded-md [&_svg]:size-3",
  sm: "size-6 rounded-md [&_svg]:size-3.5",
  md: "size-8 rounded-control [&_svg]:size-4",
  lg: "size-11 rounded-xl [&_svg]:size-5",
} as const;

export function SystemIcon({ system, size = "sm", showLabel, inactive, className }: SystemIconProps) {
  const { icon: Icon, tile } = TILES[system];
  const label = systemLabel(system);
  const glyph = (
    <span
      role={showLabel ? undefined : "img"}
      aria-label={showLabel ? undefined : label}
      aria-hidden={showLabel ? true : undefined}
      title={showLabel ? undefined : label}
      className={cn(
        "inline-grid shrink-0 place-items-center transition-opacity duration-180",
        SIZES[size],
        inactive ? "bg-surface-muted text-fg-subtle ring-1 ring-inset ring-border" : tile,
        !showLabel && className,
      )}
    >
      <Icon strokeWidth={2.25} />
    </span>
  );
  if (!showLabel) return glyph;
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-fg", inactive && "text-fg-subtle", className)}>
      {glyph}
      {label}
    </span>
  );
}
