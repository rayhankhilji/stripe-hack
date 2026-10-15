import type { EraSystem } from "@ghost/shared";

// Display names for the seven Era systems, in the order Ghost reads them.
export const SYSTEM_ORDER: readonly EraSystem[] = [
  "salesforce",
  "aws",
  "google-drive",
  "slack",
  "gong",
  "zendesk",
  "jira-confluence",
];

export const SYSTEM_LABEL: Record<EraSystem, string> = {
  salesforce: "Salesforce",
  aws: "AWS ledger",
  "google-drive": "Google Drive",
  slack: "Slack",
  gong: "Gong",
  zendesk: "Zendesk",
  "jira-confluence": "Jira & Confluence",
};

export const NEEDS_LABEL = {
  needs_review: "Needs review",
  escalated: "Escalated",
  payment_failed: "Payment failed",
  overdue: "Overdue",
} as const;
