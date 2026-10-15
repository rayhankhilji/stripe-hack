import { AppError, ERROR_CODES, type ErrorCode } from "@ghost/shared";
import { recordAudit } from "@ghost/core";

export const AGENT = { type: "agent" as const, name: "ghost-analyst" };

/** Audit one workflow step as "agent.step.<id>" so the UI activity stream shows the agent working. */
export async function auditStep(findingId: string, step: string, summary: string, data: Record<string, unknown> = {}, kind: "info" | "recommendation" | "approval_pending" | "action_executed" | "error" = "info", externalRef: string | null = null): Promise<void> {
  await recordAudit({ actorType: "agent", actor: AGENT.name, kind, action: `agent.step.${step}`, summary, subjectType: "finding", subjectId: findingId, externalRef, data });
}

/** Mastra serialises step errors to plain objects; rebuild the AppError so routes return the right envelope. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const e = (err ?? {}) as { code?: unknown; message?: unknown; details?: unknown };
  const code: ErrorCode = (ERROR_CODES as readonly unknown[]).includes(e.code) ? (e.code as ErrorCode) : "INTERNAL";
  const message = typeof e.message === "string" ? e.message : "workflow failed";
  const details = e.details && typeof e.details === "object" ? (e.details as Record<string, unknown>) : undefined;
  return new AppError(code, message, details);
}

type RunResult = { status: string; result?: unknown; error?: unknown };

export async function runWorkflow<T>(wf: { createRun: () => Promise<{ start: (a: { inputData: never }) => Promise<unknown> }> }, inputData: unknown): Promise<T> {
  const run = await wf.createRun();
  const res = (await run.start({ inputData: inputData as never })) as RunResult;
  if (res.status === "success") return res.result as T;
  throw toAppError(res.error ?? { message: `workflow ended with status ${res.status}` });
}
