import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getDb, schema } from "@ghost/db";
import { contentHash } from "./hash";
import { redact, redactDeep } from "./redact";
import type { SourceDoc } from "./documents";

export type SyncCounts = { created: number; updated: number; unchanged: number };

const BATCH = 200;

function chunks<T>(items: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function same(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return Object.keys(b).every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));
}

/**
 * Idempotent upsert keyed on a unique text column: inserts missing rows, updates rows whose fields
 * differ, and leaves identical rows untouched, so a repeat ingest writes nothing.
 */
export async function syncByKey(
  table: PgTable,
  keyColumn: PgColumn,
  keyField: string,
  rows: Record<string, unknown>[],
): Promise<{ counts: SyncCounts; ids: Map<string, string> }> {
  const db = getDb();
  const existing = (await db.select().from(table)) as Record<string, unknown>[];
  const byKey = new Map(existing.map((r) => [String(r[keyField]), r]));
  const counts: SyncCounts = { created: 0, updated: 0, unchanged: 0 };
  const toInsert: Record<string, unknown>[] = [];
  for (const row of rows) {
    const current = byKey.get(String(row[keyField]));
    if (!current) {
      toInsert.push(row);
      continue;
    }
    if (same(current, row)) {
      counts.unchanged++;
      continue;
    }
    await db.update(table).set(row).where(eq(keyColumn, row[keyField]));
    counts.updated++;
  }
  for (const batch of chunks(toInsert)) {
    await db.insert(table).values(batch);
    counts.created += batch.length;
  }
  const after = (await db.select().from(table)) as Record<string, unknown>[];
  return { counts, ids: new Map(after.map((r) => [String(r[keyField]), String(r.id)])) };
}

export const sourceKey = (system: string, recordType: string, externalId: string) =>
  `${system}|${recordType}|${externalId}`;

/** Upserts source records on (system, record_type, external_id); unchanged content (same hash) is not rewritten. */
export async function syncSourceRecords(
  docs: SourceDoc[],
  customerIds: Map<string, string>,
  ingestRunId: string,
): Promise<{ counts: SyncCounts; ids: Map<string, string> }> {
  const db = getDb();
  const sr = schema.sourceRecord;
  const existing = await db
    .select({
      id: sr.id,
      system: sr.system,
      recordType: sr.recordType,
      externalId: sr.externalId,
      contentHash: sr.contentHash,
    })
    .from(sr);
  const byKey = new Map(existing.map((r) => [sourceKey(r.system, r.recordType, r.externalId), r]));
  const ids = new Map(existing.map((r) => [sourceKey(r.system, r.recordType, r.externalId), r.id]));
  const counts: SyncCounts = { created: 0, updated: 0, unchanged: 0 };
  const toInsert: (typeof sr.$inferInsert)[] = [];
  const seen = new Set<string>();

  for (const d of docs) {
    const key = sourceKey(d.system, d.recordType, d.externalId);
    if (seen.has(key)) continue;
    seen.add(key);
    const customerId = d.accountId ? (customerIds.get(d.accountId) ?? null) : null;
    const record = {
      system: d.system,
      recordType: d.recordType,
      externalId: d.externalId,
      customerId,
      title: redact(d.title).slice(0, 500),
      bodyText: redact(d.bodyText),
      url: d.url,
      occurredAt: d.occurredAt ? new Date(d.occurredAt) : null,
      raw: redactDeep(d.raw),
    };
    const hash = contentHash({ ...record, occurredAt: d.occurredAt });
    const current = byKey.get(key);
    if (!current) {
      toInsert.push({ ...record, contentHash: hash, ingestRunId });
    } else if (current.contentHash === hash) {
      counts.unchanged++;
    } else {
      await db
        .update(sr)
        .set({ ...record, contentHash: hash, ingestRunId, fetchedAt: new Date() })
        .where(eq(sr.id, current.id));
      counts.updated++;
    }
  }
  for (const batch of chunks(toInsert)) {
    const inserted = await db.insert(sr).values(batch).returning();
    for (const r of inserted) ids.set(sourceKey(r.system, r.recordType, r.externalId), r.id);
    counts.created += inserted.length;
  }
  return { counts, ids };
}
