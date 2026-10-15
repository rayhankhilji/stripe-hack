import { eq } from "drizzle-orm";
import { getDb, migrate, schema } from "@ghost/db";
import { fetchLiveSnapshot, loadSnapshotFromFixtures, type EraSnapshot } from "@ghost/era";
import type { SfRecord } from "@ghost/era";
import type { IngestRunDTO } from "@ghost/shared";

type IngestRun = ReturnType<typeof IngestRunDTO.parse>;
import { buildDocuments, type SourceDoc } from "./documents";
import { cents, num, str } from "./fields";
import { buildCustomers, buildIdentities } from "./identity";
import { sourceKey, syncByKey, syncSourceRecords, type SyncCounts } from "./upsert";
import { pushToKnowledge } from "./knowledge";

type Stats = Record<string, number>;

function addCounts(stats: Stats, name: string, c: SyncCounts) {
  stats[`${name}Created`] = c.created;
  stats[`${name}Updated`] = c.updated;
  stats[`${name}Unchanged`] = c.unchanged;
}

function requireId(map: Map<string, string>, key: string, what: string): string {
  const id = map.get(key);
  if (!id) throw new Error(`ingest: missing ${what} ${key}`);
  return id;
}

async function ingestSnapshot(snapshot: EraSnapshot, runId: string): Promise<{ stats: Stats; docs: SourceDoc[] }> {
  const stats: Stats = {};
  const sf = snapshot.salesforce;

  const customers = await syncByKey(
    schema.customer,
    schema.customer.eraAccountId,
    "eraAccountId",
    buildCustomers(snapshot),
  );
  addCounts(stats, "customers", customers.counts);
  const customerIds = customers.ids; // eraAccountId → customer.id

  const docs = buildDocuments(snapshot);
  const sources = await syncSourceRecords(docs, customerIds, runId);
  addCounts(stats, "sourceRecords", sources.counts);
  const src = (recordType: string, id: string) =>
    requireId(sources.ids, sourceKey("salesforce", recordType, id), `source ${recordType}`);

  const db = getDb();
  const identities = buildIdentities(snapshot, docs, new Set(customerIds.keys()));
  const existingIdentities = await db
    .select({ system: schema.customerIdentity.system, externalId: schema.customerIdentity.externalId })
    .from(schema.customerIdentity);
  const have = new Set(existingIdentities.map((i) => `${i.system}|${i.externalId}`));
  const newIdentities = identities
    .filter((i) => !have.has(`${i.system}|${i.externalId}`))
    .map((i) => ({
      customerId: requireId(customerIds, i.eraAccountId, "customer"),
      system: i.system,
      externalId: i.externalId,
      matchMethod: i.matchMethod,
    }));
  if (newIdentities.length > 0) await db.insert(schema.customerIdentity).values(newIdentities).onConflictDoNothing();
  stats.identitiesCreated = newIdentities.length;

  const owned = (r: SfRecord) => customerIds.has(str(r, "AccountId") ?? "");
  const deals = await syncByKey(
    schema.deal,
    schema.deal.externalId,
    "externalId",
    sf.opportunities.filter(owned).map((o) => ({
      customerId: requireId(customerIds, String(o.AccountId), "customer"),
      externalId: o.Id,
      name: str(o, "Name") ?? o.Id,
      stage: str(o, "StageName") ?? "",
      isClosed: o.IsClosed === true,
      isWon: o.IsWon === true,
      amountCents: cents(o, "Amount"),
      closeDate: str(o, "CloseDate"),
      sourceRecordId: src("Opportunity", o.Id),
    })),
  );
  addCounts(stats, "deals", deals.counts);

  const productName = new Map(sf.products.map((p) => [p.Id, str(p, "Name")]));
  const lineRows = sf.opportunityLineItems.flatMap((l) => {
    const dealId = deals.ids.get(str(l, "OpportunityId") ?? "");
    const unit = cents(l, "UnitPrice");
    const total = cents(l, "TotalPrice");
    if (!dealId || unit === null || total === null) return [];
    return [
      {
        dealId,
        externalId: l.Id,
        productName: productName.get(str(l, "Product2Id") ?? "") ?? str(l, "Description") ?? "Unknown product",
        quantity: num(l, "Quantity") ?? 0,
        unitPriceCents: unit,
        totalCents: total,
        sourceRecordId: src("OpportunityLineItem", l.Id),
      },
    ];
  });
  addCounts(
    stats,
    "dealLineItems",
    (await syncByKey(schema.dealLineItem, schema.dealLineItem.externalId, "externalId", lineRows)).counts,
  );

  const contracts = await syncByKey(
    schema.contract,
    schema.contract.externalId,
    "externalId",
    sf.contracts.filter(owned).map((c) => ({
      customerId: requireId(customerIds, String(c.AccountId), "customer"),
      externalId: c.Id,
      status: str(c, "Status") ?? "",
      startDate: str(c, "StartDate"),
      endDate: str(c, "EndDate"),
      termMonths: num(c, "ContractTerm"),
      description: str(c, "Description"),
      specialTerms: str(c, "SpecialTerms"),
      sourceRecordId: src("Contract", c.Id),
    })),
  );
  addCounts(stats, "contracts", contracts.counts);

  const orders = await syncByKey(
    schema.salesOrder,
    schema.salesOrder.externalId,
    "externalId",
    sf.orders.filter(owned).map((o) => ({
      customerId: requireId(customerIds, String(o.AccountId), "customer"),
      externalId: o.Id,
      dealId: deals.ids.get(str(o, "OpportunityId") ?? "") ?? null,
      contractId: contracts.ids.get(str(o, "ContractId") ?? "") ?? null,
      status: str(o, "Status") ?? "",
      effectiveDate: str(o, "EffectiveDate"),
      totalCents: cents(o, "TotalAmount"),
      sourceRecordId: src("Order", o.Id),
    })),
  );
  addCounts(stats, "orders", orders.counts);

  return { stats, docs };
}

function toDto(row: typeof schema.ingestRun.$inferSelect): IngestRun {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    stats: row.stats,
    error: row.error,
  };
}

/** Pulls Era (recorded fixtures or live MCP) into the database. Re-running on the same data writes nothing new. */
export async function runIngest(opts: { source: "live" | "fixtures" }): Promise<IngestRun> {
  await migrate();
  const db = getDb();
  const [run] = await db.insert(schema.ingestRun).values({ source: opts.source }).returning();
  if (!run) throw new Error("ingest: could not create ingest_run");

  try {
    const snapshot = opts.source === "live" ? await fetchLiveSnapshot() : loadSnapshotFromFixtures();
    const { stats, docs } = await ingestSnapshot(snapshot, run.id);
    const knowledge = await pushToKnowledge(docs);
    stats.knowledgeDocuments = knowledge.added;
    const [done] = await db
      .update(schema.ingestRun)
      .set({ status: "succeeded", stats, finishedAt: new Date() })
      .where(eq(schema.ingestRun.id, run.id))
      .returning();
    if (!done) throw new Error("ingest: run row vanished");
    await db.insert(schema.auditEvent).values({
      actorType: "system",
      actor: "ingest",
      kind: "action_executed",
      action: "ingest.completed",
      summary: `Ingested Era (${opts.source}): ${stats.customersCreated ?? 0} new customers, ${stats.sourceRecordsCreated ?? 0} new and ${stats.sourceRecordsUpdated ?? 0} changed source records`,
      subjectType: "ingest",
      subjectId: run.id,
      data: { ...stats, knowledgeStatus: knowledge.status },
    });
    return toDto(done);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const [failed] = await db
      .update(schema.ingestRun)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(schema.ingestRun.id, run.id))
      .returning();
    await db.insert(schema.auditEvent).values({
      actorType: "system",
      actor: "ingest",
      kind: "error",
      action: "ingest.failed",
      summary: `Era ingest (${opts.source}) failed: ${message}`,
      subjectType: "ingest",
      subjectId: run.id,
      data: {},
    });
    if (failed) return toDto(failed);
    throw err;
  }
}
