import type { FindingDetailDTO } from "@ghost/shared";
import { getFinding, setFindingStatus } from "@ghost/core";
import { mastra } from "./mastra";
import { AGENT, auditStep, runWorkflow, toAppError } from "./workflows/run";

/** Marks a finding failed after a workflow error (never for a rejected precondition) and records the error. */
async function failFinding(findingId: string, step: string, err: unknown): Promise<void> {
  const e = toAppError(err);
  if (e.code === "INVALID_STATE" || e.code === "NOT_FOUND") return;
  const current = await getFinding(findingId);
  if (!["recovered", "rejected", "failed", "invoiced"].includes(current.status)) {
    await setFindingStatus(findingId, "failed", `${step} failed: ${e.message}`, AGENT);
  }
  await auditStep(findingId, `${step}.error`, `${step} failed: ${e.message}`, { code: e.code, details: e.details ?? {} }, "error");
}

export async function analyzeFinding(findingId: string): Promise<FindingDetailDTO> {
  try {
    await runWorkflow(mastra.getWorkflow("analyze-finding"), { findingId });
  } catch (err) {
    await failFinding(findingId, "analyze-finding", err);
    throw toAppError(err);
  }
  return getFinding(findingId);
}

export async function approveAndInvoice(findingId: string, actor: string, note?: string): Promise<FindingDetailDTO> {
  try {
    await runWorkflow(mastra.getWorkflow("approve-and-invoice"), { findingId, actor, ...(note ? { note } : {}) });
  } catch (err) {
    await failFinding(findingId, "approve-and-invoice", err);
    throw toAppError(err);
  }
  return getFinding(findingId);
}
