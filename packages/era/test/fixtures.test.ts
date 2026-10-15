import { describe, expect, it } from "vitest";
import { AWS_TABLES, loadSnapshotFromFixtures } from "../src/index";

describe("loadSnapshotFromFixtures", () => {
  const snap = loadSnapshotFromFixtures();

  it("loads every Salesforce object", () => {
    expect(snap.salesforce.accounts).toHaveLength(62);
    expect(snap.salesforce.opportunities).toHaveLength(145);
    expect(snap.salesforce.opportunityLineItems).toHaveLength(166);
    expect(snap.salesforce.orders).toHaveLength(47);
    expect(snap.salesforce.cases).toHaveLength(200);
  });

  it("has the Tidewater hero case exactly as recorded", () => {
    const won = snap.salesforce.opportunities.filter((o) => o.AccountId === "acct-6" && o.IsWon === true);
    expect(won.map((o) => o.Id)).toEqual(expect.arrayContaining(["deal-127", "deal-23", "deal-24"]));
    const draft = snap.salesforce.orders.filter((o) => o.AccountId === "acct-6" && o.Status === "Draft");
    expect(draft.map((o) => o.Id)).toEqual(expect.arrayContaining(["order-127", "order-23", "order-24"]));
    const contract = snap.salesforce.contracts.find((c) => c.Id === "contract-4");
    expect(contract?.Status).toBe("In Approval Process");
    expect(String(contract?.Description)).toContain("20 seats at 9,700 per year");
  });

  it("keys per-account collections by account id", () => {
    expect(Object.keys(snap.zendesk.ticketsByAccount)).toContain("acct-6");
    expect(Array.isArray(snap.zendesk.ticketsByAccount["acct-6"])).toBe(true);
    expect(snap.gong.callsByAccount["acct-6"]?.calls.length).toBeGreaterThan(0);
    expect(snap.slack.historyByAccount["acct-6"]?.messages.length).toBeGreaterThan(0);
    expect(Object.keys(snap.drive.searchByAccount)).toContain("acct-6");
  });

  it("loads all six AWS tables with rows", () => {
    for (const name of AWS_TABLES) expect(snap.aws[name].rows.length).toBeGreaterThan(0);
  });

  it("keys Drive files by file id and transcripts by call id", () => {
    expect(snap.drive.files["contract-deal-1"]?.content).toContain("ORDER FORM");
    expect(Object.keys(snap.gong.transcripts)).toContain("7000000000588276447");
  });

  it("throws a typed error for a missing directory", () => {
    expect(() => loadSnapshotFromFixtures("/nonexistent/era")).toThrow(/Era fixture missing/);
  });
});
