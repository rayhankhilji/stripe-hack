"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/** Radix Tabs root. `<Tabs defaultValue="commercial">` or controlled via value/onValueChange. */
export const Tabs = TabsPrimitive.Root;

export type TabsListProps = ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  /** "underline" for page sections (default), "pill" for compact filter groups. */
  variant?: "underline" | "pill";
};

export const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, TabsListProps>(function TabsList(
  { className, variant = "underline", ...props },
  ref,
) {
  return (
    <TabsPrimitive.List
      ref={ref}
      data-variant={variant}
      className={cn(
        "group/tabs flex items-center",
        variant === "underline" && "gap-5 border-b border-border",
        variant === "pill" && "inline-flex gap-1 rounded-control bg-surface-muted p-1",
        className,
      )}
      {...props}
    />
  );
});

export type TabsTriggerProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  /** Optional count shown after the label (e.g. findings per status). */
  count?: ReactNode;
};

export const TabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(function TabsTrigger(
  { className, count, children, ...props },
  ref,
) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex select-none items-center gap-2 whitespace-nowrap text-sm font-medium text-fg-muted transition-colors duration-180 ease-ghost",
        "hover:text-fg disabled:pointer-events-none disabled:opacity-45",
        // underline variant
        "group-data-[variant=underline]/tabs:relative group-data-[variant=underline]/tabs:-mb-px group-data-[variant=underline]/tabs:h-10",
        "group-data-[variant=underline]/tabs:border-b-2 group-data-[variant=underline]/tabs:border-transparent",
        "group-data-[variant=underline]/tabs:data-[state=active]:border-fg group-data-[variant=underline]/tabs:data-[state=active]:text-fg",
        // pill variant
        "group-data-[variant=pill]/tabs:h-8 group-data-[variant=pill]/tabs:rounded-lg group-data-[variant=pill]/tabs:px-3",
        "group-data-[variant=pill]/tabs:data-[state=active]:bg-surface group-data-[variant=pill]/tabs:data-[state=active]:text-fg group-data-[variant=pill]/tabs:data-[state=active]:shadow-soft",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-2xs tabular-nums text-fg-subtle ring-1 ring-inset ring-border">
          {count}
        </span>
      ) : null}
    </TabsPrimitive.Trigger>
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn("pt-5 outline-none data-[state=active]:animate-fade-in", className)}
      {...props}
    />
  );
});
