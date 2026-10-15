import { queryRows } from "@ghost/db";
import { sql } from "drizzle-orm";
import type { KnowledgeHit } from "./types";

const LIMIT = 5;
const SNIPPET_CHARS = 400;

type Row = { text: string; external_id: string; score: number | null };

function tokens(question: string): string[] {
  return [...new Set(question.toLowerCase().match(/[a-z0-9][a-z0-9-]{3,}/g) ?? [])].slice(0, 8);
}

function toHits(rows: Row[]): KnowledgeHit[] {
  return rows.map((r) => ({ text: r.text, sourceExternalIds: [r.external_id], score: r.score === null ? null : Number(r.score), via: "fts" as const }));
}

/** Postgres full-text search over source_record.body_text, scoped to the customer by name. */
async function tsvectorSearch(customerName: string, question: string): Promise<Row[]> {
  return queryRows<Row>(sql`
    SELECT left(s.body_text, ${SNIPPET_CHARS}) AS text, s.external_id AS external_id,
           ts_rank(to_tsvector('english', s.body_text), q) AS score
    FROM source_record s
    JOIN customer c ON c.id = s.customer_id,
         websearch_to_tsquery('english', ${question}) q
    WHERE lower(c.name) = lower(${customerName}) AND to_tsvector('english', s.body_text) @@ q
    ORDER BY score DESC, s.external_id
    LIMIT ${LIMIT}`);
}

/** ILIKE fallback for drivers without full-text support, or questions that parse to nothing. */
async function ilikeSearch(customerName: string, question: string): Promise<Row[]> {
  const terms = tokens(question);
  if (terms.length === 0) return [];
  const anyTerm = sql.join(terms.map((t) => sql`s.body_text ILIKE ${`%${t}%`}`), sql` OR `);
  return queryRows<Row>(sql`
    SELECT left(s.body_text, ${SNIPPET_CHARS}) AS text, s.external_id AS external_id, NULL::float AS score
    FROM source_record s JOIN customer c ON c.id = s.customer_id
    WHERE lower(c.name) = lower(${customerName}) AND (${anyTerm})
    ORDER BY s.external_id
    LIMIT ${LIMIT}`);
}

export async function searchFts(customerName: string, question: string): Promise<KnowledgeHit[]> {
  try {
    const rows = await tsvectorSearch(customerName, question);
    if (rows.length > 0) return toHits(rows);
  } catch (err) {
    process.stderr.write(`fts: tsvector search unavailable, using ILIKE (${String(err)})\n`);
  }
  return toHits(await ilikeSearch(customerName, question));
}

export async function searchableDocumentCount(): Promise<number> {
  const rows = await queryRows<{ n: number | string }>(sql`SELECT count(*) AS n FROM source_record WHERE body_text <> ''`);
  return Number(rows[0]?.n ?? 0);
}
