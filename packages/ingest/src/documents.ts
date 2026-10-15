import type { EraSnapshot } from "@ghost/era";
import type { EraSystem } from "@ghost/shared";
import { cents, isoOrNull, isRecord, money, num, str, type Raw } from "./fields";

/** One Era record, flattened for `source_record`. `bodyText` starts with the §5 quote line for its role. */
export type SourceDoc = {
  system: EraSystem;
  recordType: string;
  externalId: string;
  accountId: string | null; // Era account id ("acct-6") when the record belongs to one
  title: string;
  bodyText: string;
  url: string | null;
  occurredAt: string | null;
  raw: Raw;
};

const lines = (...parts: (string | null)[]) => parts.filter((p): p is string => !!p && p.trim() !== "").join("\n");
const sfUrl = (r: Raw) => (isRecord(r.attributes) ? str(r.attributes, "url") : null);

/** §5 quote formats. B5's detector builds the same strings, so keep them byte-identical. */
export const quote = {
  opportunity: (r: Raw) =>
    `"${str(r, "Name") ?? ""}" — ${str(r, "StageName") ?? ""}, ${money(cents(r, "Amount"))}, closed ${str(r, "CloseDate") ?? ""}`,
  lineItem: (r: Raw) => `${str(r, "Description") ?? ""} ${money(cents(r, "TotalPrice"))}`,
  contract: (r: Raw) =>
    `${str(r, "Description") ?? ""} ${str(r, "SpecialTerms") ?? ""} Status: ${str(r, "Status") ?? ""}`,
  order: (r: Raw) =>
    `Order ${str(r, "OrderNumber") ?? ""} status ${str(r, "Status") ?? ""}, effective ${str(r, "EffectiveDate") ?? ""}, ${money(cents(r, "TotalAmount"))}`,
  payment: (r: Raw) => `payment ${str(r, "event_id") ?? ""} ${money(num(r, "amount_cents"))} ${str(r, "status") ?? ""}`,
};

function salesforceDocs(sf: EraSnapshot["salesforce"]): SourceDoc[] {
  const oppAccount = new Map(sf.opportunities.map((o) => [o.Id, str(o, "AccountId")]));
  const orderAccount = new Map(sf.orders.map((o) => [o.Id, str(o, "AccountId")]));
  const contractAccount = new Map(sf.contracts.map((c) => [c.Id, str(c, "AccountId")]));
  const productName = new Map(sf.products.map((p) => [p.Id, str(p, "Name")]));
  const doc = (
    recordType: string,
    r: Raw & { Id: string },
    accountId: string | null,
    title: string,
    bodyText: string,
    at: unknown,
  ): SourceDoc => ({
    system: "salesforce",
    recordType,
    externalId: r.Id,
    accountId,
    title,
    bodyText,
    url: sfUrl(r),
    occurredAt: isoOrNull(at),
    raw: r,
  });
  return [
    ...sf.accounts.map((a) =>
      doc(
        "Account",
        a,
        a.Id,
        str(a, "Name") ?? a.Id,
        lines(
          `${str(a, "Name")} (${a.Id}) — ${str(a, "Type") ?? ""}, ${str(a, "Industry") ?? ""}`,
          `Plan ${str(a, "Subscription_Plan__c") ?? "none"}, ${str(a, "Licensed_Seats__c") ?? "?"} seats, ARR ${money(cents(a, "ARR__c"))}, renewal ${str(a, "Renewal_Date__c") ?? "n/a"}`,
        ),
        a.CreatedDate,
      ),
    ),
    ...sf.opportunities.map((o) =>
      doc(
        "Opportunity",
        o,
        str(o, "AccountId"),
        str(o, "Name") ?? o.Id,
        lines(quote.opportunity(o), str(o, "Description")),
        o.CloseDate,
      ),
    ),
    ...sf.opportunityLineItems.map((l) => {
      const opp = str(l, "OpportunityId");
      const product = productName.get(str(l, "Product2Id") ?? "") ?? null;
      return doc(
        "OpportunityLineItem",
        l,
        opp ? (oppAccount.get(opp) ?? null) : null,
        str(l, "Description") ?? product ?? l.Id,
        lines(
          quote.lineItem(l),
          `${product ?? "Product"} × ${num(l, "Quantity") ?? "?"} at ${money(cents(l, "UnitPrice"))} on ${opp ?? "unknown deal"}`,
        ),
        null,
      );
    }),
    ...sf.contracts.map((c) =>
      doc(
        "Contract",
        c,
        str(c, "AccountId"),
        `Contract ${str(c, "ContractNumber") ?? c.Id}`,
        lines(
          quote.contract(c),
          `Term ${str(c, "StartDate") ?? "?"} to ${str(c, "EndDate") ?? "?"} (${num(c, "ContractTerm") ?? "?"} months)`,
        ),
        c.StartDate,
      ),
    ),
    ...sf.orders.map((o) =>
      doc(
        "Order",
        o,
        str(o, "AccountId"),
        `Order ${str(o, "OrderNumber") ?? o.Id}`,
        lines(
          quote.order(o),
          `Opportunity ${str(o, "OpportunityId") ?? "none"}, contract ${str(o, "ContractId") ?? "none"}, type ${str(o, "Type") ?? ""}`,
        ),
        o.EffectiveDate,
      ),
    ),
    ...sf.orderItems.map((i) => {
      const order = str(i, "OrderId");
      return doc(
        "OrderItem",
        i,
        order ? (orderAccount.get(order) ?? null) : null,
        `${productName.get(str(i, "Product2Id") ?? "") ?? "Item"} on ${order ?? "?"}`,
        `${productName.get(str(i, "Product2Id") ?? "") ?? "Product"} × ${num(i, "Quantity") ?? "?"} ${money(cents(i, "TotalPrice"))}, ${str(i, "ServiceDate") ?? "?"} to ${str(i, "EndDate") ?? "?"}`,
        i.ServiceDate,
      );
    }),
    ...sf.products.map((p) =>
      doc("Product2", p, null, str(p, "Name") ?? p.Id, lines(str(p, "Name"), str(p, "Description")), null),
    ),
    ...sf.users.map((u) =>
      doc("User", u, null, str(u, "Name") ?? u.Id, lines(str(u, "Name"), str(u, "Title"), str(u, "Email")), null),
    ),
    ...sf.contacts.map((c) =>
      doc(
        "Contact",
        c,
        str(c, "AccountId"),
        `${str(c, "FirstName") ?? ""} ${str(c, "LastName") ?? ""}`.trim() || c.Id,
        lines(`${str(c, "FirstName") ?? ""} ${str(c, "LastName") ?? ""}`.trim(), str(c, "Title"), str(c, "Email")),
        null,
      ),
    ),
    ...sf.cases.map((c) =>
      doc(
        "Case",
        c,
        str(c, "AccountId"),
        str(c, "Subject") ?? c.Id,
        lines(
          str(c, "Subject"),
          `${str(c, "Type") ?? ""} · ${str(c, "Status") ?? ""} · ${str(c, "Priority") ?? ""}`,
          str(c, "Description"),
        ),
        c.CreatedDate,
      ),
    ),
    ...sf.contractHistory.map((h) => {
      const contractId = str(h, "ContractId");
      return doc(
        "ContractHistory",
        h,
        contractId ? (contractAccount.get(contractId) ?? null) : null,
        `${contractId ?? "Contract"} ${str(h, "Field") ?? ""} change`,
        `${contractId ?? ""} ${str(h, "Field") ?? ""}: ${str(h, "OldValue") ?? "—"} → ${str(h, "NewValue") ?? "—"}`,
        h.CreatedDate,
      );
    }),
  ];
}

function zendeskDocs(zd: EraSnapshot["zendesk"]): SourceDoc[] {
  const docs: SourceDoc[] = zd.organizations.map((o) => ({
    system: "zendesk",
    recordType: "organization",
    externalId: String(o.id),
    accountId: o.external_id,
    title: o.name,
    bodyText: lines(o.name, str(o, "details"), str(o, "notes")),
    url: str(o, "url"),
    occurredAt: isoOrNull(o.created_at),
    raw: o,
  }));
  for (const [accountId, tickets] of Object.entries(zd.ticketsByAccount)) {
    for (const t of tickets) {
      docs.push({
        system: "zendesk",
        recordType: "ticket",
        externalId: String(t.id),
        accountId,
        title: t.subject,
        bodyText: lines(
          t.subject,
          str(t, "description"),
          `Status ${str(t, "status") ?? ""}, priority ${str(t, "priority") ?? ""}, type ${str(t, "type") ?? ""}`,
        ),
        url: str(t, "url"),
        occurredAt: isoOrNull(t.created_at),
        raw: t,
      });
    }
  }
  return docs;
}

function awsDocs(aws: EraSnapshot["aws"]): SourceDoc[] {
  const docs: SourceDoc[] = [];
  for (const [table, data] of Object.entries(aws)) {
    for (const row of data.rows) {
      const key =
        table === "dim_customer"
          ? str(row, "customer_id")
          : table === "dim_product"
            ? str(row, "sku")
            : table === "agg_daily_revenue"
              ? `${str(row, "dt")}:${str(row, "customer_id")}`
              : str(row, "event_id");
      if (!key) continue;
      const bodyText =
        table === "fact_payments"
          ? quote.payment(row)
          : table === "fact_ledger_entries"
            ? `ledger ${key} ${money(num(row, "amount_cents"))} ${str(row, "status") ?? ""}`
            : table === "agg_daily_revenue"
              ? `revenue ${str(row, "dt")} ${money(num(row, "net_revenue_cents"))} net, ${num(row, "orders") ?? 0} orders`
              : table === "dim_customer"
                ? `${str(row, "customer_name")} (${key}) ${str(row, "domain") ?? ""}, ${str(row, "tier") ?? ""}, closed won ${money(num(row, "closed_won_cents"))}`
                : table === "dim_product"
                  ? `${key} ${str(row, "product_name") ?? ""} (${str(row, "category") ?? ""})`
                  : `${table} ${key} ${str(row, "customer_id") ?? ""}`;
      const kept = Object.fromEntries(Object.entries(row).filter(([k]) => k !== "embedding" && k !== "row_digest"));
      docs.push({
        system: "aws",
        recordType: table,
        externalId: key,
        accountId: str(row, "customer_id"),
        title: `${table} ${key}`,
        bodyText,
        url: null,
        occurredAt: isoOrNull(row.occurred_at ?? row.dt ?? null),
        raw: kept,
      });
    }
  }
  return docs;
}

type DriveMeta = Raw & { id: string; name: string };

function driveDocs(drive: EraSnapshot["drive"], accountNames: Map<string, string>): SourceDoc[] {
  const byId = new Map<string, SourceDoc>();
  // A Drive file belongs to an account when its name carries the account name or its text says "(acct-N)".
  const owner = (name: string, text: string, hint: string | null): string | null => {
    for (const [acct, accountName] of accountNames) if (name.includes(accountName)) return acct;
    const tagged = [...accountNames.keys()].filter((acct) => text.includes(`(${acct})`));
    if (tagged.length === 1) return tagged[0] ?? null;
    if (hint && tagged.includes(hint)) return hint;
    return null;
  };
  for (const [acct, result] of Object.entries(drive.searchByAccount)) {
    const files = isRecord(result) && Array.isArray(result.files) ? (result.files as DriveMeta[]) : [];
    for (const f of files) {
      if (byId.has(f.id)) continue;
      const snippet = str(f, "contentSnippet") ?? "";
      byId.set(f.id, {
        system: "google-drive",
        recordType: "file",
        externalId: f.id,
        accountId: owner(f.name, snippet, acct),
        title: f.name,
        bodyText: lines(f.name, snippet),
        url: str(f, "webViewLink"),
        occurredAt: isoOrNull(f.modifiedTime),
        raw: f,
      });
    }
  }
  for (const f of Object.values(drive.files)) {
    const meta = byId.get(f.id);
    byId.set(f.id, {
      system: "google-drive",
      recordType: "file",
      externalId: f.id,
      accountId: owner(f.name, f.content, meta?.accountId ?? null),
      title: f.name,
      bodyText: f.content,
      url: meta?.url ?? null,
      occurredAt: meta?.occurredAt ?? null,
      raw: { ...(meta?.raw ?? {}), ...f },
    });
  }
  if (isRecord(drive.accountsSheet)) {
    const values = Array.isArray(drive.accountsSheet.values) ? (drive.accountsSheet.values as unknown[][]) : [];
    byId.set("sheet-accounts", {
      system: "google-drive",
      recordType: "spreadsheet",
      externalId: str(drive.accountsSheet, "spreadsheetId") ?? "sheet-accounts",
      accountId: null,
      title: "Accounts",
      bodyText: values.map((row) => row.map(String).join(" | ")).join("\n"),
      url: null,
      occurredAt: null,
      raw: drive.accountsSheet,
    });
  }
  return [...byId.values()];
}

function slackDocs(slack: EraSnapshot["slack"]): SourceDoc[] {
  return Object.entries(slack.historyByAccount).flatMap(([channel, history]) =>
    history.messages.map((m) => ({
      system: "slack" as const,
      recordType: "message",
      externalId: `${channel}:${m.ts}`,
      accountId: channel,
      title: m.text.slice(0, 120),
      bodyText: m.text,
      url: null,
      occurredAt: isoOrNull(Number(m.ts) * 1000),
      raw: m,
    })),
  );
}

function gongDocs(gong: EraSnapshot["gong"]): SourceDoc[] {
  const callAccount = new Map<string, string>();
  const docs: SourceDoc[] = [];
  for (const [acct, calls] of Object.entries(gong.callsByAccount)) {
    for (const c of calls.calls) {
      callAccount.set(c.id, acct);
      docs.push({
        system: "gong",
        recordType: "call",
        externalId: c.id,
        accountId: acct,
        title: c.title,
        bodyText: lines(
          c.title,
          `Purpose ${str(c, "purpose") ?? "n/a"}, ${Math.round((num(c, "duration") ?? 0) / 60)} min, ${str(c, "system") ?? ""}`,
        ),
        url: str(c, "url"),
        occurredAt: isoOrNull(c.started),
        raw: c,
      });
    }
  }
  for (const [callId, t] of Object.entries(gong.transcripts)) {
    const parts = isRecord(t) && Array.isArray(t.transcript) ? (t.transcript as Raw[]) : [];
    const text = parts
      .flatMap((p) => (Array.isArray(p.sentences) ? (p.sentences as Raw[]) : []).map((s) => str(s, "text") ?? ""))
      .filter(Boolean)
      .join("\n");
    docs.push({
      system: "gong",
      recordType: "transcript",
      externalId: callId,
      accountId: callAccount.get(callId) ?? null,
      title: `Transcript ${callId}`,
      bodyText: text,
      url: null,
      occurredAt: null,
      raw: isRecord(t) ? t : { value: t },
    });
  }
  return docs;
}

/** Flattens a snapshot into source documents for every system. Deterministic for a given snapshot. */
export function buildDocuments(snapshot: EraSnapshot): SourceDoc[] {
  const accountNames = new Map(snapshot.salesforce.accounts.map((a) => [a.Id, str(a, "Name") ?? a.Id]));
  return [
    ...salesforceDocs(snapshot.salesforce),
    ...zendeskDocs(snapshot.zendesk),
    ...awsDocs(snapshot.aws),
    ...driveDocs(snapshot.drive, accountNames),
    ...slackDocs(snapshot.slack),
    ...gongDocs(snapshot.gong),
  ];
}
