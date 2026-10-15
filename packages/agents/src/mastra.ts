import { Mastra } from "@mastra/core/mastra";
import { analyzeFindingWorkflow } from "./workflows/analyze-finding";
import { approveAndInvoiceWorkflow } from "./workflows/approve-and-invoice";

// Ghost's own audit_event table is the record of every step, so Mastra's logger stays off.
export const mastra = new Mastra({
  workflows: { "analyze-finding": analyzeFindingWorkflow, "approve-and-invoice": approveAndInvoiceWorkflow },
  logger: false,
});
