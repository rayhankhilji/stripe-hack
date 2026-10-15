import type { EraSnapshot } from "@ghost/era";
import type { EraSystem } from "@ghost/shared";
import { cents, isRecord, num, str } from "./fields";
import type { SourceDoc } from "./documents";

export type CustomerRow = {
  eraAccountId: string;
  name: string;
  domain: string | null;
  status: "active" | "churned" | "prospect";
  tier: string | null;
  segment: string | null;
  arrCents: number | null;
  licensedSeats: number | null;
  renewalDate: string | null;
  billingEmail: string | null;
};

export type IdentityRow = {
  eraAccountId: string;
  system: EraSystem;
  externalId: string;
  matchMethod: "exact_id" | "external_id" | "domain" | "name";
};

function domainOf(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website.includes("://") ? website : `https://${website}`).hostname.replace(/^www\./, "");
  } catch {
    return null; // a malformed Website field means the domain is unknown, not an error
  }
}

/** Customers are Salesforce Accounts with Id LIKE 'acct-%'. Status: Zendesk "churned" wins, else Account Type. */
export function buildCustomers(snapshot: EraSnapshot): CustomerRow[] {
  const zdStatus = new Map(
    snapshot.zendesk.organizations.map((o) => [
      o.external_id ?? "",
      isRecord(o.organization_fields) ? str(o.organization_fields, "account_status") : null,
    ]),
  );
  const firstContactEmail = new Map<string, string>();
  for (const c of snapshot.salesforce.contacts) {
    const acct = str(c, "AccountId");
    const email = str(c, "Email");
    if (acct && email && !firstContactEmail.has(acct)) firstContactEmail.set(acct, email);
  }
  return snapshot.salesforce.accounts
    .filter((a) => a.Id.startsWith("acct-"))
    .map((a) => ({
      eraAccountId: a.Id,
      name: str(a, "Name") ?? a.Id,
      domain: domainOf(str(a, "Website")),
      status: zdStatus.get(a.Id) === "churned" ? "churned" : str(a, "Type") === "Customer" ? "active" : "prospect",
      tier: str(a, "Tier__c"),
      segment: str(a, "Segment__c"),
      arrCents: cents(a, "ARR__c"),
      licensedSeats: num(a, "Licensed_Seats__c"),
      renewalDate: str(a, "Renewal_Date__c"),
      billingEmail: firstContactEmail.get(a.Id) ?? null,
    }));
}

/**
 * Cross-system identities: Salesforce Id, Zendesk org external_id, Slack channel id = acct id,
 * Gong calls listed under the CRM account id, AWS dim_customer.customer_id, Drive files by account name.
 */
export function buildIdentities(snapshot: EraSnapshot, docs: SourceDoc[], customerIds: Set<string>): IdentityRow[] {
  const out: IdentityRow[] = [];
  const add = (row: IdentityRow) => {
    if (customerIds.has(row.eraAccountId)) out.push(row);
  };
  for (const acct of customerIds)
    add({ eraAccountId: acct, system: "salesforce", externalId: acct, matchMethod: "exact_id" });
  for (const o of snapshot.zendesk.organizations) {
    if (o.external_id)
      add({ eraAccountId: o.external_id, system: "zendesk", externalId: String(o.id), matchMethod: "external_id" });
  }
  for (const acct of Object.keys(snapshot.slack.historyByAccount))
    add({ eraAccountId: acct, system: "slack", externalId: acct, matchMethod: "exact_id" });
  for (const [acct, calls] of Object.entries(snapshot.gong.callsByAccount)) {
    if (calls.calls.length > 0) add({ eraAccountId: acct, system: "gong", externalId: acct, matchMethod: "exact_id" });
  }
  for (const row of snapshot.aws.dim_customer.rows) {
    const acct = str(row, "customer_id");
    if (acct) add({ eraAccountId: acct, system: "aws", externalId: acct, matchMethod: "exact_id" });
  }
  for (const d of docs) {
    if (d.system === "google-drive" && d.recordType === "file" && d.accountId) {
      add({ eraAccountId: d.accountId, system: "google-drive", externalId: d.externalId, matchMethod: "name" });
    }
  }
  return out;
}
