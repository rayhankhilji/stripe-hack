import { AppError, type EraSystem } from "@ghost/shared";
import { cogneeAdd, cogneeCognify, cogneeDocumentCount, cogneeHealthy, cogneeSearch, extractSourceIds } from "./cognee";
import { searchableDocumentCount, searchFts } from "./fts";
import type { KnowledgeHit } from "./types";

export type { KnowledgeHit } from "./types";

/** Cognee gets this long to answer a search before we fall back to Postgres FTS. */
const SEARCH_TIMEOUT_MS = 3_000;

export async function addDocuments(
  docs: { externalId: string; system: EraSystem; customerEraId: string | null; title: string; text: string }[],
): Promise<{ added: number }> {
  if (docs.length === 0) return { added: 0 };
  await cogneeAdd(docs);
  return { added: docs.length };
}

export async function cognify(): Promise<void> {
  await cogneeCognify();
}

/** Cognee GRAPH_COMPLETION; on error or timeout falls back to FTS over source_record.body_text. */
export async function searchContext(customerName: string, question: string): Promise<KnowledgeHit[]> {
  try {
    const query = `${customerName}: ${question}`;
    const [answers, chunks] = await Promise.all([
      cogneeSearch(query, "GRAPH_COMPLETION", SEARCH_TIMEOUT_MS),
      cogneeSearch(query, "CHUNKS", SEARCH_TIMEOUT_MS),
    ]);
    const sourceExternalIds = extractSourceIds(chunks.join("\n"));
    if (answers.length === 0) throw new AppError("UPSTREAM_COGNEE", "Cognee returned no answer");
    return answers.map((text) => ({ text, sourceExternalIds, score: null, via: "cognee" as const }));
  } catch (err) {
    process.stderr.write(
      `knowledge: cognee search failed, using FTS (${err instanceof Error ? err.message : String(err)})\n`,
    );
    return searchFts(customerName, question);
  }
}

export async function knowledgeStatus(): Promise<{ cognee: "up" | "down"; documents: number }> {
  if (await cogneeHealthy()) {
    const count = await cogneeDocumentCount().catch(() => null);
    if (count !== null) return { cognee: "up", documents: count };
    return { cognee: "up", documents: await searchableDocumentCount() };
  }
  return { cognee: "down", documents: await searchableDocumentCount() };
}
