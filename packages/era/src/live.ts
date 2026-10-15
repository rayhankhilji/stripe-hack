import { AppError } from "@ghost/shared";
import { callEraTool } from "./client";
import {
  AWS_TABLES,
  type AwsTable,
  type AwsTableName,
  type DriveFile,
  type EraSnapshot,
  type GongCalls,
  type SfRecord,
  type SlackHistory,
  type ZdOrg,
  type ZdTicket,
} from "./types";

/** Accounts whose Gong/Slack/Zendesk/Drive history the recorded fixtures carry. */
export const KEY_ACCOUNTS = [
  "acct-3",
  "acct-6",
  "acct-7",
  "acct-8",
  "acct-9",
  "acct-21",
  "acct-33",
  "acct-39",
] as const;
const CASE_ACCOUNTS = ["acct-3", "acct-6", "acct-7", "acct-8"] as const;
const PAGE = 100;
const MAX_DRIVE_FILES = 12;

/** SOQL per object; field lists are the columns present in fixtures/era/salesforce/*.json. */
const SOQL = {
  accounts:
    "SELECT Id, Name, Type, Industry, Website, NumberOfEmployees, AnnualRevenue, Tier__c, ARR__c, Licensed_Seats__c, Subscription_Plan__c, Renewal_Date__c, Health_Score__c, Renewal_Risk_Score__c, Billing_Status__c, Onboarding_Status__c, Segment__c, External_Id__c, OwnerId, CreatedDate FROM Account WHERE Id LIKE 'acct-%'",
  opportunities:
    "SELECT Id, Name, AccountId, StageName, Amount, CloseDate, IsClosed, IsWon, Probability, Type, OwnerId, Description, Discount_Percent__c, CreatedDate, LastModifiedDate FROM Opportunity",
  opportunityLineItems:
    "SELECT Id, OpportunityId, Product2Id, PricebookEntryId, Quantity, UnitPrice, TotalPrice, ListPrice, Description FROM OpportunityLineItem",
  contracts:
    "SELECT Id, AccountId, ContractNumber, Status, StartDate, EndDate, ContractTerm, Description, SpecialTerms, SLA_Credit_Pct__c, ActivatedDate, CreatedDate FROM Contract",
  orders:
    "SELECT Id, AccountId, OpportunityId, ContractId, Status, EffectiveDate, EndDate, TotalAmount, OrderNumber, Type, CreatedDate, ActivatedDate FROM Order",
  orderItems: "SELECT Id, OrderId, Product2Id, Quantity, UnitPrice, TotalPrice, ServiceDate, EndDate FROM OrderItem",
  products: "SELECT Id, Name, ProductCode, Family, Description, IsActive FROM Product2",
  users: "SELECT Id, Name, Email, Title FROM User",
  contacts: "SELECT Id, AccountId, FirstName, LastName, Email, Title, Phone FROM Contact LIMIT 200",
  contractHistory: "SELECT Id, ContractId, Field, OldValue, NewValue, CreatedDate FROM ContractHistory",
} as const;

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Finds the row array in a tool result: the value itself, or the first of `keys` that holds an array. */
function listFrom<T>(result: unknown, ...keys: string[]): T[] {
  if (Array.isArray(result)) return result as T[];
  const obj = asRecord(result);
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v)) return v as T[];
  }
  throw new AppError("UPSTREAM_ERA", "Era tool result did not contain the expected list", {
    expectedKeys: keys,
    gotKeys: Object.keys(obj),
  });
}

async function soql(query: string): Promise<SfRecord[]> {
  const rows: SfRecord[] = [];
  let locator: string | null = null;
  do {
    const args: Record<string, unknown> = { query };
    if (locator) args.queryLocator = locator;
    const res = asRecord(await callEraTool("salesforce", "run_soql_query", args));
    rows.push(...listFrom<SfRecord>(res, "records"));
    const next = res.queryLocator;
    locator = res.done === false && typeof next === "string" && next ? next : null;
  } while (locator);
  return rows;
}

async function pagedList<T>(
  system: "zendesk",
  tool: string,
  args: Record<string, unknown>,
  ...keys: string[]
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = listFrom<T>(await callEraTool(system, tool, { ...args, limit: PAGE, offset }), ...keys);
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

async function awsTable(name: AwsTableName): Promise<AwsTable> {
  const res = await callEraTool("aws", "query_datasets", { sql: `SELECT * FROM ${name}` });
  const table = asRecord(res);
  if (!Array.isArray(table.rows))
    throw new AppError("UPSTREAM_ERA", `AWS query for ${name} returned no rows array`, { name });
  return table as AwsTable;
}

async function eachAccount<T>(fn: (acct: string) => Promise<T>): Promise<Record<string, T>> {
  const entries = await Promise.all(KEY_ACCOUNTS.map(async (acct) => [acct, await fn(acct)] as const));
  return Object.fromEntries(entries);
}

async function driveFiles(search: Record<string, unknown>): Promise<Record<string, DriveFile>> {
  const wanted = new Map<string, string>();
  for (const result of Object.values(search)) {
    for (const f of (asRecord(result).files as { id: string; name: string }[] | undefined) ?? []) {
      if (/order form|contract|dispute/i.test(f.name)) wanted.set(f.id, f.name);
    }
  }
  const ids = [...wanted.keys()].slice(0, MAX_DRIVE_FILES);
  const files = await Promise.all(ids.map((id) => callEraTool("google-drive", "read_file", { file_id: id })));
  return Object.fromEntries(
    files.map((f, i) => [ids[i] as string, { id: ids[i] as string, ...asRecord(f) } as DriveFile]),
  );
}

/** Same calls the recorder makes, via the MCP SDK. Shapes mirror fixtures/era. */
export async function fetchLiveSnapshot(): Promise<EraSnapshot> {
  const [
    accounts,
    opportunities,
    opportunityLineItems,
    contracts,
    orders,
    orderItems,
    products,
    users,
    contacts,
    contractHistory,
  ] = await Promise.all(
    (
      [
        "accounts",
        "opportunities",
        "opportunityLineItems",
        "contracts",
        "orders",
        "orderItems",
        "products",
        "users",
        "contacts",
        "contractHistory",
      ] as const
    ).map((k) => soql(SOQL[k])),
  );
  const cases = await soql(
    `SELECT Id, AccountId, Subject, Type, Status, Priority, CreatedDate, Description FROM Case WHERE AccountId IN (${CASE_ACCOUNTS.map((a) => `'${a}'`).join(", ")})`,
  );

  const organizations = await pagedList<ZdOrg>("zendesk", "list_organizations", {}, "organizations");
  const orgByAccount = new Map(organizations.map((o) => [o.external_id, o.id]));
  const ticketsByAccount = await eachAccount(async (acct) => {
    const orgId = orgByAccount.get(acct);
    if (orgId === undefined) throw new AppError("UPSTREAM_ERA", `No Zendesk organization for ${acct}`, { acct });
    return pagedList<ZdTicket>("zendesk", "list_organization_tickets", { organization_id: orgId }, "tickets");
  });

  const aws = Object.fromEntries(
    await Promise.all(AWS_TABLES.map(async (n) => [n, await awsTable(n)] as const)),
  ) as Record<AwsTableName, AwsTable>;

  const searchByAccount = await eachAccount((acct) =>
    callEraTool("google-drive", "search_files", { query: acct, page_size: 50 }),
  );
  const accountsSheet = await callEraTool("google-drive", "read_sheet_tab", {
    file_id: "sheet-accounts",
    tab_name: "Accounts",
  });

  const channels = await callEraTool("slack", "slack_list_channels", { limit: 100 });
  const historyByAccount = await eachAccount(
    async (acct) =>
      (await callEraTool("slack", "slack_get_channel_history", { channel_id: acct, limit: 100 })) as SlackHistory,
  );

  const callsByAccount = await eachAccount(
    async (acct) =>
      (await callEraTool("gong", "list_calls_for_entity", {
        crmEntityType: "Account",
        crmEntityId: acct,
      })) as GongCalls,
  );
  const transcripts: Record<string, unknown> = {};
  for (const { calls } of Object.values(callsByAccount)) {
    for (const call of calls.filter((c) => /expansion|commercial review|order form/i.test(c.title))) {
      transcripts[call.id] = await callEraTool("gong", "get_call_transcript", { callId: call.id });
    }
  }

  return {
    salesforce: {
      accounts: accounts ?? [],
      opportunities: opportunities ?? [],
      opportunityLineItems: opportunityLineItems ?? [],
      contracts: contracts ?? [],
      orders: orders ?? [],
      orderItems: orderItems ?? [],
      products: products ?? [],
      users: users ?? [],
      contacts: contacts ?? [],
      cases,
      contractHistory: contractHistory ?? [],
    },
    zendesk: { organizations, ticketsByAccount },
    aws,
    drive: { accountsSheet, files: await driveFiles(searchByAccount), searchByAccount },
    slack: { channels, historyByAccount },
    gong: { callsByAccount, transcripts },
  };
}
