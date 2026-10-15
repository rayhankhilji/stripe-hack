import type { EraSystem } from "@ghost/shared";

export type { EraSystem };

/** Salesforce sobject row as returned by SOQL (and as stored in fixtures/era/salesforce/*.json). */
export type SfRecord = { Id: string } & Record<string, unknown>;

export type ZdOrg = { id: number; external_id: string | null; name: string } & Record<string, unknown>;
export type ZdTicket = { id: number; subject: string; organization_id: number | null } & Record<string, unknown>;

export type AwsTable = {
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
} & Record<string, unknown>;

export type DriveFile = { id: string; name: string; mimeType: string; truncated: boolean; content: string };

export type SlackMessage = { ts: string; text: string } & Record<string, unknown>;
export type SlackHistory = { ok: boolean; messages: SlackMessage[]; has_more: boolean } & Record<string, unknown>;

export type GongCall = { id: string; title: string; started: string } & Record<string, unknown>;
export type GongCalls = { calls: GongCall[] } & Record<string, unknown>;

export const AWS_TABLES = [
  "dim_customer",
  "fact_payments",
  "fact_ledger_entries",
  "fact_ledger_entries_lines",
  "dim_product",
  "agg_daily_revenue",
] as const;
export type AwsTableName = (typeof AWS_TABLES)[number];

/** The exact shapes of fixtures/era/**. */
export type EraSnapshot = {
  salesforce: {
    accounts: SfRecord[];
    opportunities: SfRecord[];
    opportunityLineItems: SfRecord[];
    contracts: SfRecord[];
    orders: SfRecord[];
    orderItems: SfRecord[];
    products: SfRecord[];
    users: SfRecord[];
    contacts: SfRecord[];
    cases: SfRecord[];
    contractHistory: SfRecord[];
  };
  zendesk: { organizations: ZdOrg[]; ticketsByAccount: Record<string, ZdTicket[]> };
  aws: Record<AwsTableName, AwsTable>;
  drive: { accountsSheet: unknown; files: Record<string, DriveFile>; searchByAccount: Record<string, unknown> };
  slack: { channels: unknown; historyByAccount: Record<string, SlackHistory> };
  gong: { callsByAccount: Record<string, GongCalls>; transcripts: Record<string, unknown> };
};
