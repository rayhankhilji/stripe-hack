import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AppError } from "@ghost/shared";
import { getEraToken } from "./token";
import type { EraSystem } from "./types";

const CALL_TIMEOUT_MS = 20_000;

const clients = new Map<EraSystem, Promise<Client>>();

/** `ERA_MCP_URL_TEMPLATE` (e.g. http://127.0.0.1:9000/{system}/mcp/) overrides the Era host; used to point tests at a local MCP server. */
export function eraMcpUrl(system: EraSystem): URL {
  const template = process.env.ERA_MCP_URL_TEMPLATE;
  if (template) return new URL(template.replace("{system}", system));
  const domain = process.env.ERA_MCP_BASE_DOMAIN;
  if (!domain)
    throw new AppError("UPSTREAM_ERA", "ERA_MCP_BASE_DOMAIN is not set; cannot reach Era live", {
      missing: "ERA_MCP_BASE_DOMAIN",
    });
  return new URL(`https://${system}-mcp.${domain}/mcp/`);
}

async function connect(system: EraSystem): Promise<Client> {
  // The token is read per request so a long-lived client survives token refresh.
  const authedFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${await getEraToken()}`);
    return fetch(input, { ...init, headers });
  };
  const transport = new StreamableHTTPClientTransport(eraMcpUrl(system), { fetch: authedFetch });
  const client = new Client({ name: "ghost", version: "0.1.0" });
  await client.connect(transport, { signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
  return client;
}

function clientFor(system: EraSystem): Promise<Client> {
  let existing = clients.get(system);
  if (!existing) {
    existing = connect(system).catch((err: unknown) => {
      clients.delete(system);
      throw new AppError("UPSTREAM_ERA", `Era ${system} MCP connection failed`, { system, cause: String(err) });
    });
    clients.set(system, existing);
  }
  return existing;
}

/** Unwraps an MCP tool result: structuredContent first, then JSON in the first text block, else raw text. */
export function parseToolResult(result: object): unknown {
  const { content, structuredContent } = result as { content?: unknown; structuredContent?: unknown };
  if (structuredContent !== undefined && structuredContent !== null) return structuredContent;
  const blocks = Array.isArray(content) ? (content as { type?: string; text?: string }[]) : [];
  const text = blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text; // non-JSON tool output is legitimate (e.g. document text); callers validate what they need
  }
}

/** One Era MCP tool call. 20s timeout; a dropped connection is retried once with a fresh client. */
export async function callEraTool(system: EraSystem, tool: string, args: Record<string, unknown>): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const client = await clientFor(system);
    try {
      const result = await client.callTool({ name: tool, arguments: args }, undefined, {
        timeout: CALL_TIMEOUT_MS,
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      if ("isError" in result && result.isError) {
        throw new AppError("UPSTREAM_ERA", `Era ${system}.${tool} returned an error`, {
          system,
          tool,
          detail: String(parseToolResult(result)).slice(0, 500),
        });
      }
      return parseToolResult(result);
    } catch (err) {
      if (err instanceof AppError) throw err;
      clients.delete(system);
      await client.close().catch(() => undefined); // already failing; closing is best-effort
      if (attempt === 1)
        throw new AppError("UPSTREAM_ERA", `Era ${system}.${tool} failed`, { system, tool, cause: String(err) });
    }
  }
}

export async function closeEraClients(): Promise<void> {
  const open = [...clients.values()];
  clients.clear();
  await Promise.all(open.map(async (p) => (await p.catch(() => null))?.close()));
}
