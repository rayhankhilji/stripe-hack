import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { callEraTool, closeEraClients, getEraToken } from "../src/index";
import { clearEraTokenCache } from "../src/token";

let server: Server;
let base = "";
let tokenRequests = 0;
let sawAuth: string[] = [];

beforeAll(async () => {
  server = createServer(async (req, res) => {
    if (req.url === "/token") {
      tokenRequests++;
      let body = "";
      for await (const chunk of req) body += String(chunk);
      const form = new URLSearchParams(body);
      const ok = form.get("grant_type") === "client_credentials" && form.get("client_id") === "cid" && form.get("client_secret") === "sec";
      res.writeHead(ok ? 200 : 401, { "content-type": "application/json" });
      res.end(JSON.stringify(ok ? { access_token: `tok-${tokenRequests}`, expires_in: 3600 } : { error: "bad" }));
      return;
    }
    sawAuth.push(String(req.headers.authorization));
    const mcp = new McpServer({ name: "fake-era", version: "1.0.0" });
    mcp.registerTool("echo", { inputSchema: { value: z.string() } }, async ({ value }) => ({ content: [{ type: "text", text: JSON.stringify({ value }) }] }));
    mcp.registerTool("boom", {}, async () => ({ isError: true, content: [{ type: "text", text: "nope" }] }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => void transport.close());
    await mcp.connect(transport);
    await transport.handleRequest(req, res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await closeEraClients();
  await new Promise((r) => server.close(r));
});

beforeEach(() => {
  clearEraTokenCache();
  tokenRequests = 0;
  sawAuth = [];
  process.env.ERA_TOKEN_URL = `${base}/token`;
  process.env.ERA_CLIENT_ID = "cid";
  process.env.ERA_CLIENT_SECRET = "sec";
  process.env.ERA_MCP_URL_TEMPLATE = `${base}/{system}/mcp/`;
});

describe("token cache", () => {
  it("reuses a token until 5 minutes before expiry, then refreshes", async () => {
    const t0 = 1_000_000;
    expect(await getEraToken(t0)).toBe("tok-1");
    expect(await getEraToken(t0 + 3600_000 - 6 * 60_000)).toBe("tok-1");
    expect(await getEraToken(t0 + 3600_000 - 4 * 60_000)).toBe("tok-2");
    expect(tokenRequests).toBe(2);
  });

  it("raises UPSTREAM_ERA on bad credentials", async () => {
    process.env.ERA_CLIENT_SECRET = "wrong";
    await expect(getEraToken()).rejects.toMatchObject({ code: "UPSTREAM_ERA" });
    clearEraTokenCache();
  });

  it("raises UPSTREAM_ERA when secrets are missing", async () => {
    delete process.env.ERA_CLIENT_ID;
    await expect(getEraToken()).rejects.toMatchObject({ code: "UPSTREAM_ERA", details: { missing: "ERA_CLIENT_ID" } });
  });
});

describe("callEraTool over a real MCP transport", () => {
  it("sends the bearer token and parses JSON text results", async () => {
    const result = await callEraTool("salesforce", "echo", { value: "hi" });
    expect(result).toEqual({ value: "hi" });
    expect(sawAuth.length).toBeGreaterThan(0);
    expect(sawAuth.every((h) => h === "Bearer tok-1")).toBe(true);
  });

  it("maps tool errors to UPSTREAM_ERA", async () => {
    await expect(callEraTool("salesforce", "boom", {})).rejects.toMatchObject({ code: "UPSTREAM_ERA" });
  });
});
