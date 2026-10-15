"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  className?: string;
};

/** Self-contained tooltip (brings its own provider). The child must be a focusable element or forward refs. */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 250,
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={6}
            className={cn(
              "z-50 max-w-xs rounded-lg bg-forest px-2.5 py-1.5 text-xs leading-snug text-porcelain shadow-lift",
              "data-[state=closed]:animate-fade-out data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in",
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
