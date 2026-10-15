import { AppError } from "@ghost/shared";

const DEFAULT_TIMEOUT_MS = 30_000;

export type CogneeDoc = { externalId: string; system: string; title: string; text: string };

function baseUrl(): string {
  return (process.env.COGNEE_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

export function datasetName(): string {
  return process.env.COGNEE_DATASET ?? "sapora";
}

let auth: { token: string } | null = null;

/** Login is `POST /api/v1/auth/login` (form) and only when credentials are configured. */
async function authHeaders(timeoutMs: number): Promise<Record<string, string>> {
  const username = process.env.COGNEE_USERNAME;
  const password = process.env.COGNEE_PASSWORD;
  if (!username || !password) return {};
  if (!auth) {
    const res = await fetch(`${baseUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new AppError("UPSTREAM_COGNEE", `Cognee login returned ${res.status}`, { status: res.status });
    const body = (await res.json()) as { access_token?: unknown };
    if (typeof body.access_token !== "string") throw new AppError("UPSTREAM_COGNEE", "Cognee login response had no access_token");
    auth = { token: body.access_token };
  }
  return { authorization: `Bearer ${auth.token}` };
}

export function resetCogneeAuth(): void {
  auth = null;
}

async function request(path: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  try {
    const headers = { ...(await authHeaders(timeoutMs)), ...(init.headers as Record<string, string> | undefined) };
    const res = await fetch(`${baseUrl()}${path}`, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 401) resetCogneeAuth();
    if (!res.ok) throw new AppError("UPSTREAM_COGNEE", `Cognee ${path} returned ${res.status}`, { status: res.status, body: (await res.text()).slice(0, 300) });
    const text = await res.text();
    return text ? (JSON.parse(text) as unknown) : null;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("UPSTREAM_COGNEE", `Cognee ${path} failed`, { cause: String(err) });
  }
}

/** The `[source: system:externalId]` header lets search results be traced back to Era records. */
export function sourceMarker(system: string, externalId: string): string {
  return `[source: ${system}:${externalId}]`;
}

const MARKER = /\[source: ([a-z-]+):([^\]\s]+)\]/g;

export function extractSourceIds(text: string): string[] {
  return [...new Set([...text.matchAll(MARKER)].map((m) => m[2] as string))];
}

export async function cogneeAdd(docs: CogneeDoc[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  const form = new FormData();
  form.set("datasetName", datasetName());
  for (const d of docs) {
    const body = `${sourceMarker(d.system, d.externalId)} ${d.title}\n${d.text}`;
    form.append("data", new Blob([body], { type: "text/plain" }), `${d.system}__${d.externalId}.txt`);
  }
  await request("/api/v1/add", { method: "POST", body: form }, timeoutMs);
}

export async function cogneeCognify(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  await request(
    "/api/v1/cognify",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ datasets: [datasetName()], run_in_background: false }) },
    timeoutMs,
  );
}

function resultTexts(result: unknown): string[] {
  const items = Array.isArray(result) ? result : result === null ? [] : [result];
  return items.flatMap((item): string[] => {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const inner = o.search_result ?? o.text ?? o.content;
      if (typeof inner === "string") return [inner];
      if (Array.isArray(inner)) return resultTexts(inner);
    }
    return [];
  });
}

export async function cogneeSearch(query: string, searchType: "GRAPH_COMPLETION" | "CHUNKS", timeoutMs: number): Promise<string[]> {
  const result = await request(
    "/api/v1/search",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, search_type: searchType, datasets: [datasetName()], top_k: 5 }) },
    timeoutMs,
  );
  return resultTexts(result);
}

export async function cogneeHealthy(timeoutMs = 2_000): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch (err) {
    process.stderr.write(`cognee health check failed: ${String(err)}\n`);
    return false;
  }
}

/** Number of documents Cognee holds for the dataset, or null when it cannot be read. */
export async function cogneeDocumentCount(timeoutMs = 3_000): Promise<number | null> {
  const datasets = (await request("/api/v1/datasets", { method: "GET" }, timeoutMs)) as { id: string; name: string }[] | null;
  const ds = datasets?.find((d) => d.name === datasetName());
  if (!ds) return 0;
  const data = (await request(`/api/v1/datasets/${ds.id}/data`, { method: "GET" }, timeoutMs)) as unknown[] | null;
  return Array.isArray(data) ? data.length : null;
}
