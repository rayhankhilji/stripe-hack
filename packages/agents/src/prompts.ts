import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "@ghost/shared";

export type Prompt = { id: string; version: string; text: string };

const cache = new Map<string, Prompt>();

// Bundlers (Next) rewrite import.meta.url to a chunk path, so also look relative to the process cwd.
function candidateDirs(): string[] {
  const dirs: string[] = [];
  try {
    dirs.push(path.join(path.dirname(fileURLToPath(import.meta.url)), "prompts"));
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
  }
  dirs.push(path.join(process.cwd(), "packages/agents/src/prompts"), path.join(process.cwd(), "../../packages/agents/src/prompts"));
  return dirs;
}

export function loadPrompt(name: "explain-finding" | "expansion-email"): Prompt {
  const hit = cache.get(name);
  if (hit) return hit;
  const file = candidateDirs().map((d) => path.join(d, `${name}.md`)).find((f) => existsSync(f));
  if (!file) throw new AppError("INTERNAL", `prompt ${name}.md not found`);
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new AppError("INTERNAL", `prompt ${name}.md has no version header`);
  const version = m[1]?.match(/version:\s*(\S+)/)?.[1];
  if (!version) throw new AppError("INTERNAL", `prompt ${name}.md has no version`);
  const prompt = { id: name, version: `${name}@${version}`, text: (m[2] ?? "").trim() };
  cache.set(name, prompt);
  return prompt;
}
