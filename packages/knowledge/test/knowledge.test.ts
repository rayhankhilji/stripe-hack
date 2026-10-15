import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { closeDb, getDb, migrate, schema } from "@ghost/db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { addDocuments, knowledgeStatus, searchContext } from "../src/index";

let server: Server | null = null;
let requests: { method: string; url: string; body: string }[] = [];
let searchHandler: (type: string) => { status: number; body: unknown } | "hang" = () => ({ status: 200, body: [] });

async function startFakeCognee(): Promise<string> {
  server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += String(chunk);
    requests.push({ method: req.method ?? "", url: req.url ?? "", body });
    const json = (status: number, payload: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    if (req.url === "/health") return json(200, { status: "ok" });
    if (req.url === "/api/v1/add" || req.url === "/api/v1/cognify") return json(200, {});
    if (req.url === "/api/v1/datasets") return json(200, [{ id: "ds-1", name: "sapora" }]);
    if (req.url === "/api/v1/datasets/ds-1/data") return json(200, [{}, {}, {}]);
    if (req.url === "/api/v1/search") {
      const out = searchHandler((JSON.parse(body) as { search_type: string }).search_type);
      if (out === "hang") return;
      return json(out.status, out.body);
    }
    json(404, {});
  });
  await new Promise<void>((r) => server?.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  process.env.PGLITE_DIR = "memory://";
  delete process.env.DATABASE_URL;
  await migrate();
  const db = getDb();
  const [cust] = await db.insert(schema.customer).values({ eraAccountId: "acct-6", name: "Tidewater Capital" }).returning();
  const base = { system: "salesforce" as const, raw: {}, contentHash: "h", customerId: cust?.id };
  await db.insert(schema.sourceRecord).values([
    { ...base, recordType: "Contract", externalId: "contract-4", title: "Contract 4", bodyText: "Business plan for Tidewater Capital: 20 seats at 9,700 per year. Status: In Approval Process" },
    { ...base, recordType: "Order", externalId: "order-127", title: "Order 127", bodyText: "Order 00127 status Draft, effective 2026-05-01, $51,500" },
  ]);
});

afterEach(async () => {
  delete process.env.COGNEE_BASE_URL;
  requests = [];
  searchHandler = () => ({ status: 200, body: [] });
  if (server) await new Promise((r) => server?.close(r));
  server = null;
});

afterAll(closeDb);

describe("searchContext FTS fallback", () => {
  it("falls back instantly when Cognee is unreachable", async () => {
    process.env.COGNEE_BASE_URL = "http://127.0.0.1:1"; // nothing listens here
    const t0 = Date.now();
    const hits = await searchContext("Tidewater Capital", "contract seats approval");
    expect(Date.now() - t0).toBeLessThan(3_000);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.via === "fts")).toBe(true);
    expect(hits[0]?.sourceExternalIds).toEqual(["contract-4"]);
    expect(hits[0]?.text).toContain("20 seats");
  });

  it("falls back within 3s when Cognee hangs", async () => {
    process.env.COGNEE_BASE_URL = await startFakeCognee();
    searchHandler = () => "hang";
    const t0 = Date.now();
    const hits = await searchContext("Tidewater Capital", "Draft order");
    expect(Date.now() - t0).toBeLessThan(4_000);
    expect(hits[0]?.via).toBe("fts");
    expect(hits[0]?.sourceExternalIds).toEqual(["order-127"]);
  });

  it("returns nothing, not invented text, when no record matches", async () => {
    process.env.COGNEE_BASE_URL = "http://127.0.0.1:1";
    expect(await searchContext("Tidewater Capital", "zebra unicorn")).toEqual([]);
    expect(await searchContext("Unknown Corp", "contract")).toEqual([]);
  });
});

describe("Cognee path", () => {
  it("returns GRAPH_COMPLETION answers with source ids parsed from CHUNKS", async () => {
    process.env.COGNEE_BASE_URL = await startFakeCognee();
    searchHandler = (type) =>
      type === "GRAPH_COMPLETION"
        ? { status: 200, body: ["Tidewater has three won deals with Draft orders."] }
        : { status: 200, body: [{ text: "[source: salesforce:deal-127] Deal 127" }, { text: "[source: salesforce:order-127] x" }] };
    const hits = await searchContext("Tidewater Capital", "unbilled revenue");
    expect(hits).toEqual([{ text: "Tidewater has three won deals with Draft orders.", sourceExternalIds: ["deal-127", "order-127"], score: null, via: "cognee" }]);
  });

  it("adds documents as source-tagged files and cognifies", async () => {
    process.env.COGNEE_BASE_URL = await startFakeCognee();
    const { cognify } = await import("../src/index");
    const res = await addDocuments([{ externalId: "deal-127", system: "salesforce", customerEraId: "acct-6", title: "Deal 127", text: "won" }]);
    await cognify();
    expect(res).toEqual({ added: 1 });
    const add = requests.find((r) => r.url === "/api/v1/add");
    expect(add?.body).toContain("[source: salesforce:deal-127] Deal 127");
    expect(add?.body).toContain("salesforce__deal-127.txt");
    expect(requests.find((r) => r.url === "/api/v1/cognify")?.body).toContain('"sapora"');
  });

  it("reports status from Cognee, and down with DB document count when unreachable", async () => {
    process.env.COGNEE_BASE_URL = await startFakeCognee();
    expect(await knowledgeStatus()).toEqual({ cognee: "up", documents: 3 });
    await new Promise((r) => server?.close(r));
    server = null;
    process.env.COGNEE_BASE_URL = "http://127.0.0.1:1";
    expect(await knowledgeStatus()).toEqual({ cognee: "down", documents: 2 });
  });
});
