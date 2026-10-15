"use client";

import type { EraSystem } from "@ghost/shared";
import { useId } from "react";
import { cn } from "../../lib/cn";
import { ERA_SYSTEMS, systemLabel } from "../../lib/format/systems";
import { systemTile } from "./system-icon";

export type EvidenceGraphProps = {
  /** Customer shown in the centre tile. */
  customerName: string;
  /** Systems to place around the customer. Default: all 7 Era systems. */
  systems?: readonly EraSystem[];
  /** Systems whose trail is lit (evidence found / being read). */
  activeSystems?: readonly EraSystem[];
  /** Optional record count per system, rendered under its tile. */
  counts?: Partial<Record<EraSystem, number>>;
  className?: string;
};

const W = 520;
const H = 340;
const CX = W / 2;
const CY = H / 2;
const RX = 200;
const RY = 122;
const TILE = 44;
const CENTER = 76;

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Customer node in the centre, source systems around it, revenue trails between them.
 * A trail draws in (stroke-dashoffset) when its system becomes active. Pure SVG; inherits panel tokens.
 */
export function EvidenceGraph({ customerName, systems = ERA_SYSTEMS, activeSystems = [], counts, className }: EvidenceGraphProps) {
  const uid = useId();
  const active = new Set(activeSystems);
  const n = systems.length;

  const nodes = systems.map((system, i) => {
    // Start at the top and walk clockwise so layouts are stable for a given system list.
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { system, x: CX + RX * Math.cos(angle), y: CY + RY * Math.sin(angle), angle };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby={`${uid}-t`}
      className={cn("h-auto w-full select-none overflow-visible", className)}
    >
      <title id={`${uid}-t`}>
        {`${customerName}: evidence from ${activeSystems.length ? activeSystems.map(systemLabel).join(", ") : "no systems yet"}`}
      </title>

      {nodes.map(({ system, x, y }) => {
        // Gentle curve: control point pulled toward the centre's vertical axis.
        const mx = (CX + x) / 2;
        const my = (CY + y) / 2 - (x - CX) * 0.12;
        const d = `M ${CX} ${CY} Q ${mx} ${my} ${x} ${y}`;
        const on = active.has(system);
        return (
          <g key={`trail-${system}`}>
            <path d={d} fill="none" stroke="var(--color-border-strong)" strokeWidth={1} strokeDasharray="2 5" strokeLinecap="round" />
            <path
              d={d}
              fill="none"
              pathLength={1}
              data-active={on}
              className="trail-draw"
              stroke="var(--color-accent)"
              strokeWidth={1.75}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {nodes.map(({ system, x, y }) => {
        const on = active.has(system);
        const { icon: Icon, tile } = systemTile(system);
        const count = counts?.[system];
        return (
          <g
            key={system}
            transform={`translate(${x - TILE / 2} ${y - TILE / 2})`}
            className="transition-opacity duration-280 ease-ghost"
            opacity={on || active.size === 0 ? 1 : 0.45}
          >
            <title>{`${systemLabel(system)}${count !== undefined ? ` · ${count} records` : ""}`}</title>
            <foreignObject width={TILE} height={TILE} overflow="visible">
              <div
                className={cn(
                  "grid size-full place-items-center rounded-xl transition-[box-shadow,transform] duration-280 ease-ghost [&_svg]:size-5",
                  tile,
                  on && "shadow-ring",
                )}
              >
                <Icon strokeWidth={2.25} aria-hidden />
              </div>
            </foreignObject>
            <text x={TILE / 2} y={TILE + 16} textAnchor="middle" className="fill-fg-muted text-2xs font-medium">
              {systemLabel(system)}
            </text>
            {count !== undefined ? (
              <text x={TILE / 2} y={TILE + 29} textAnchor="middle" className="fill-fg-subtle font-mono text-2xs">
                {count}
              </text>
            ) : null}
          </g>
        );
      })}

      <g transform={`translate(${CX - CENTER / 2} ${CY - CENTER / 2})`}>
        <rect width={CENTER} height={CENTER} rx={22} className="fill-petal" />
        <text x={CENTER / 2} y={CENTER / 2 + 8} textAnchor="middle" className="fill-forest font-display text-2xl font-semibold">
          {initials(customerName)}
        </text>
      </g>
      <text x={CX} y={CY + CENTER / 2 + 18} textAnchor="middle" className="fill-fg text-xs font-semibold">
        {customerName}
      </text>
    </svg>
  );
}
