import type { EraSystem } from "@ghost/shared";
import type { SourceDoc } from "./documents";
import { redact } from "./redact";

type KnowledgeDoc = {
  externalId: string;
  system: EraSystem;
  customerEraId: string | null;
  title: string;
  text: string;
};
type KnowledgeApi = {
  addDocuments?: (docs: KnowledgeDoc[]) => Promise<{ added: number }>;
  cognify?: () => Promise<void>;
};

/**
 * Best effort: Cognee is optional and the FTS fallback reads source_record directly, so a knowledge
 * failure is reported in the run stats/audit but never fails the ingest.
 */
export async function pushToKnowledge(docs: SourceDoc[]): Promise<{ added: number; status: string }> {
  const api = (await import("@ghost/knowledge")) as KnowledgeApi;
  if (typeof api.addDocuments !== "function" || typeof api.cognify !== "function")
    return { added: 0, status: "unavailable" };
  const payload = docs
    .filter((d) => d.bodyText.trim() !== "" && d.accountId !== null)
    .map((d) => ({
      externalId: d.externalId,
      system: d.system,
      customerEraId: d.accountId,
      title: redact(d.title),
      text: redact(d.bodyText),
    }));
  try {
    const { added } = await api.addDocuments(payload);
    await api.cognify();
    return { added, status: "synced" };
  } catch (err) {
    return { added: 0, status: `failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
