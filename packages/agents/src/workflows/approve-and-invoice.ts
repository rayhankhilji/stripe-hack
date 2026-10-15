import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { AppError, formatCents, type InvoiceDTO } from "@ghost/shared";
import { getFinding, recordApproval, setFindingStatus } from "@ghost/core";
import { callTool, invoiceFindingTool } from "../tools/finding-tools";
import { auditStep } from "./run";

const Input = z.object({ findingId: z.string().uuid(), actor: z.string().min(1), note: z.string().optional() });
const Approved = Input.extend({ approved: z.literal(true) });

const assertReady = createStep({
  id: "assert-ready",
  inputSchema: Input,
  outputSchema: Input,
  execute: async ({ inputData }) => {
    const f = await getFinding(inputData.findingId);
    if (f.status !== "ready_for_approval") throw new AppError("INVALID_STATE", `finding is ${f.status}, not ready_for_approval`, { status: f.status });
    return inputData;
  },
});

const approve = createStep({
  id: "record-approval",
  inputSchema: Input,
  outputSchema: Approved,
  execute: async ({ inputData }) => {
    const before = await getFinding(inputData.findingId);
    // A finding re-analysed after a failed invoice keeps its original approval row (one per finding).
    if (before.approval?.decision !== "approved") await recordApproval(inputData.findingId, "approved", inputData.actor, inputData.note);
    const after = await getFinding(inputData.findingId);
    if (after.status !== "approved") await setFindingStatus(inputData.findingId, "approved", `Approved by ${inputData.actor}${inputData.note ? `: ${inputData.note}` : ""}`, { type: "operator", name: inputData.actor });
    await auditStep(inputData.findingId, "record-approval", `${inputData.actor} approved invoicing ${formatCents(after.amountCents)}`, { actor: inputData.actor });
    return { ...inputData, approved: true as const };
  },
});

const invoice = createStep({
  id: "invoice",
  inputSchema: Approved,
  outputSchema: z.object({ findingId: z.string(), stripeInvoiceId: z.string() }),
  execute: async ({ inputData }) => {
    const { invoice: inv } = await callTool<{ findingId: string; actor: string }, { invoice: InvoiceDTO }>(invoiceFindingTool, { findingId: inputData.findingId, actor: inputData.actor });
    await auditStep(inputData.findingId, "invoice", `Created Stripe test-mode invoice ${inv.number ?? inv.stripeInvoiceId} for ${formatCents(inv.amountDueCents)}`, { status: inv.status }, "action_executed", inv.stripeInvoiceId);
    return { findingId: inputData.findingId, stripeInvoiceId: inv.stripeInvoiceId };
  },
});

export const approveAndInvoiceWorkflow = createWorkflow({
  id: "approve-and-invoice",
  inputSchema: Input,
  outputSchema: z.object({ findingId: z.string(), stripeInvoiceId: z.string() }),
})
  .then(assertReady)
  .then(approve)
  .then(invoice)
  .commit();
