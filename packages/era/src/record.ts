import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeEraClients } from "./client";
import { fetchLiveSnapshot } from "./live";
import { redactPans } from "./redact";
import type { EraSnapshot } from "./types";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/era");

function write(out: string, rel: string, data: unknown): void {
  const path = join(out, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(redactPans(data), null, 1)}\n`);
}

/** Writes a live snapshot in the exact layout loadSnapshotFromFixtures reads. Card data never reaches disk. */
export function writeSnapshot(s: EraSnapshot, out: string = OUT): void {
  const sf = s.salesforce;
  const files: [string, unknown][] = [
    ["accounts", sf.accounts],
    ["opportunities", sf.opportunities],
    ["opportunity_line_items", sf.opportunityLineItems],
    ["contracts", sf.contracts],
    ["orders", sf.orders],
    ["order_items", sf.orderItems],
    ["products", sf.products],
    ["users", sf.users],
    ["contacts", sf.contacts],
    ["cases_key", sf.cases],
    ["contract_history", sf.contractHistory],
  ];
  for (const [name, rows] of files) write(out, `salesforce/${name}.json`, rows);

  write(out, "zendesk/organizations.json", s.zendesk.organizations);
  for (const [acct, tickets] of Object.entries(s.zendesk.ticketsByAccount))
    write(out, `zendesk/tickets/${acct}.json`, tickets);
  for (const [name, table] of Object.entries(s.aws)) write(out, `aws/${name}.json`, table);
  write(out, "google-drive/sheet-accounts.json", s.drive.accountsSheet);
  for (const [id, file] of Object.entries(s.drive.files)) write(out, `google-drive/files/${id}.json`, file);
  for (const [acct, res] of Object.entries(s.drive.searchByAccount))
    write(out, `google-drive/search/${acct}.json`, res);
  write(out, "slack/channels.json", s.slack.channels);
  for (const [acct, h] of Object.entries(s.slack.historyByAccount)) write(out, `slack/history/${acct}.json`, h);
  for (const [acct, c] of Object.entries(s.gong.callsByAccount)) write(out, `gong/calls/${acct}.json`, c);
  for (const [id, t] of Object.entries(s.gong.transcripts)) write(out, `gong/transcripts/${id}.json`, t);
}

async function main(): Promise<void> {
  writeSnapshot(await fetchLiveSnapshot());
  await closeEraClients();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    process.stderr.write(`era:record failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
