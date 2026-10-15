import { and, desc, eq, lt, or, type SQL } from "drizzle-orm";
import { getDb, schema } from "@ghost/db";
import { AppError, type AuditEventDTO } from "@ghost/shared";

type AuditRow = typeof schema.auditEvent.$inferSelect;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export type AuditInput = Omit<AuditEventDTO, "id" | "occurredAt" | "data"> & { data?: Record<string, unknown> };

export function toAuditDTO(row: AuditRow): AuditEventDTO {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    actorType: row.actorType,
    actor: row.actor,
    kind: row.kind,
    action: row.action,
    summary: row.summary,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    externalRef: row.externalRef,
    data: row.data,
  };
}

/** Appends one immutable audit row. The timestamp is set here (ms precision) so keyset cursors stay exact. */
export async function recordAudit(e: AuditInput): Promise<void> {
  await getDb().insert(schema.auditEvent).values({
    occurredAt: new Date(),
    actorType: e.actorType,
    actor: e.actor,
    kind: e.kind,
    action: e.action,
    summary: e.summary,
    subjectType: e.subjectType,
    subjectId: e.subjectId,
    externalRef: e.externalRef,
    data: e.data ?? {},
  });
}

function encodeCursor(row: AuditRow): string {
  return Buffer.from(`${row.occurredAt.toISOString()}|${row.id}`).toString("base64url");
}

function decodeCursor(cursor: string): { at: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime()) || !id) throw new AppError("VALIDATION", "Invalid cursor");
  return { at, id };
}

/** Newest first. Keyset pagination on (occurred_at, id) so rows written during paging never shift pages. */
export async function listAudit(q: {
  subjectType?: string;
  subjectId?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: AuditEventDTO[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(q.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const t = schema.auditEvent;
  const where: (SQL | undefined)[] = [];
  if (q.subjectType) {
    const parsed = t.subjectType.enumValues.find((v) => v === q.subjectType);
    if (!parsed) throw new AppError("VALIDATION", `Unknown subjectType: ${q.subjectType}`);
    where.push(eq(t.subjectType, parsed));
  }
  if (q.subjectId) where.push(eq(t.subjectId, q.subjectId));
  if (q.cursor) {
    const c = decodeCursor(q.cursor);
    where.push(or(lt(t.occurredAt, c.at), and(eq(t.occurredAt, c.at), lt(t.id, c.id))));
  }
  const rows = await getDb()
    .select()
    .from(t)
    .where(and(...where))
    .orderBy(desc(t.occurredAt), desc(t.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { items: page.map(toAuditDTO), nextCursor: rows.length > limit && last ? encodeCursor(last) : null };
}
