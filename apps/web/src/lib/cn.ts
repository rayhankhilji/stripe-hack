import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about our custom radius and text tokens so `cn("rounded-card", "rounded-panel")` resolves.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["control", "card", "panel"],
      text: ["2xs"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
