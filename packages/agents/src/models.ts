import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateText, Output } from "ai";
import type { z } from "zod";
import { AppError } from "@ghost/shared";

export const TEMPLATE_MODEL = "template@1";
const OPENAI_TIMEOUT_MS = 60_000;

let resolvedModelId: string | null = null;

export function llmEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function provider() {
  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function isModelNotFound(err: unknown): boolean {
  if (!APICallError.isInstance(err)) return false;
  return err.statusCode === 404 || /model.*(not found|does not exist)/i.test(err.message);
}

const NON_CHAT = /audio|realtime|transcribe|tts|image|search|embedding|instruct|moderation/;

/** Newest gpt-* chat model the account can use; used only when the configured model is missing. */
async function newestChatModel(): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}` },
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });
  if (!res.ok) throw new AppError("UPSTREAM_LLM", `listing models failed: ${res.status}`);
  const body = (await res.json()) as { data?: { id: string; created: number }[] };
  const best = (body.data ?? [])
    .filter((m) => /^gpt-\d/.test(m.id) && !NON_CHAT.test(m.id))
    .sort((a, b) => b.created - a.created)[0];
  if (!best) throw new AppError("UPSTREAM_LLM", "no gpt-* chat model available");
  return best.id;
}

/** Structured generation with zod validation. Returns the model id actually used. */
export async function generateStructured<T>(opts: { instructions: string; prompt: string; schema: z.ZodType<T> }): Promise<{ output: T; model: string }> {
  const run = async (modelId: string) => {
    const result = await generateText({
      model: provider()(modelId),
      instructions: opts.instructions,
      prompt: opts.prompt,
      output: Output.object({ schema: opts.schema }),
      abortSignal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      maxRetries: 1,
    });
    return { output: opts.schema.parse(result.output), model: modelId };
  };
  const modelId = resolvedModelId ?? process.env.GHOST_REASONING_MODEL ?? "gpt-5.1";
  try {
    return await run(modelId);
  } catch (err) {
    if (!isModelNotFound(err)) throw err;
    resolvedModelId = await newestChatModel();
    return await run(resolvedModelId);
  }
}
