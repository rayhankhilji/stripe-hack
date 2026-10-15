"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./button";

export type ErrorStateProps = {
  title?: ReactNode;
  /** The thrown error (AppError from `api()` carries `code`); its message is shown verbatim. */
  error?: unknown;
  /** Explicit message; takes precedence over `error.message`. */
  message?: ReactNode;
  /** Shows a "Try again" button, typically `() => query.refetch()`. */
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  size?: "sm" | "md";
};

function describe(error: unknown): { message: string | null; code: string | null } {
  if (!error) return { message: null, code: null };
  if (typeof error === "string") return { message: error, code: null };
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : null;
    return { message: error.message, code };
  }
  return { message: null, code: null };
}

export function ErrorState({ title = "Something went wrong", error, message: explicit, onRetry, retrying, className, size = "md" }: ErrorStateProps) {
  const described = describe(error);
  const message = explicit ?? described.message;
  const code = described.code;
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center text-center", size === "md" ? "gap-3 px-6 py-14" : "gap-2 px-4 py-8", className)}
    >
      <div aria-hidden className="grid size-11 place-items-center rounded-card bg-punch/10 text-punch dark:text-petal">
        <TriangleAlert className="size-5" />
      </div>
      <h3 className="text-base font-semibold tracking-tight text-fg">{title}</h3>
      {message ? <p className="max-w-md text-sm text-fg-muted">{message}</p> : null}
      {code ? <code className="font-mono text-2xs uppercase tracking-wider text-fg-subtle">{code}</code> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry} loading={retrying} icon={<RotateCw aria-hidden />}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
