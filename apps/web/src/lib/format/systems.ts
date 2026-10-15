import type { EraSystem } from "@ghost/shared";

export const ERA_SYSTEMS: readonly EraSystem[] = ["salesforce", "google-drive", "slack", "gong", "jira-confluence", "zendesk", "aws"];

const LABELS: Record<EraSystem, string> = {
  salesforce: "Salesforce",
  "google-drive": "Google Drive",
  slack: "Slack",
  gong: "Gong",
  "jira-confluence": "Jira & Confluence",
  zendesk: "Zendesk",
  aws: "AWS",
};

export function systemLabel(system: EraSystem): string {
  return LABELS[system];
}
