import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "@ghost/shared";
import {
  AWS_TABLES,
  type AwsTable,
  type AwsTableName,
  type DriveFile,
  type EraSnapshot,
  type GongCalls,
  type SfRecord,
  type SlackHistory,
  type ZdTicket,
} from "./types";

const DEFAULT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/era");

function readJson(path: string): unknown {
  if (!existsSync(path)) throw new AppError("NOT_FOUND", `Era fixture missing: ${path}`, { path });
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (err) {
    throw new AppError("INTERNAL", `Era fixture is not valid JSON: ${path}`, { path, cause: String(err) });
  }
}

function readArray<T>(path: string): T[] {
  const data = readJson(path);
  if (!Array.isArray(data)) throw new AppError("INTERNAL", `Era fixture must be a JSON array: ${path}`, { path });
  return data as T[];
}

function readObject<T extends object>(path: string): T {
  const data = readJson(path);
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new AppError("INTERNAL", `Era fixture must be a JSON object: ${path}`, { path });
  }
  return data as T;
}

/** Every `<dir>/<id>.json`, keyed by file name without extension. Missing dir means no records. */
function readDirByName<T>(dir: string, read: (path: string) => T): Record<string, T> {
  if (!existsSync(dir)) return {};
  const out: Record<string, T> = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    out[basename(file, ".json")] = read(join(dir, file));
  }
  return out;
}

function readAwsTable(dir: string, name: AwsTableName): AwsTable {
  const table = readObject<AwsTable>(join(dir, "aws", `${name}.json`));
  if (!Array.isArray(table.rows)) throw new AppError("INTERNAL", `AWS fixture ${name} has no rows array`, { name });
  return table;
}

/** Loads the recorded Era snapshot from `fixtures/era` (or `dir`). Synchronous, deterministic, offline. */
export function loadSnapshotFromFixtures(dir: string = DEFAULT_DIR): EraSnapshot {
  const sf = (file: string) => readArray<SfRecord>(join(dir, "salesforce", `${file}.json`));
  const aws = Object.fromEntries(AWS_TABLES.map((name) => [name, readAwsTable(dir, name)])) as Record<AwsTableName, AwsTable>;
  const driveFiles = readDirByName(join(dir, "google-drive", "files"), readObject<DriveFile>);

  return {
    salesforce: {
      accounts: sf("accounts"),
      opportunities: sf("opportunities"),
      opportunityLineItems: sf("opportunity_line_items"),
      contracts: sf("contracts"),
      orders: sf("orders"),
      orderItems: sf("order_items"),
      products: sf("products"),
      users: sf("users"),
      contacts: sf("contacts"),
      cases: sf("cases_key"),
      contractHistory: sf("contract_history"),
    },
    zendesk: {
      organizations: readArray(join(dir, "zendesk", "organizations.json")),
      ticketsByAccount: readDirByName(join(dir, "zendesk", "tickets"), readArray<ZdTicket>),
    },
    aws,
    drive: {
      accountsSheet: readJson(join(dir, "google-drive", "sheet-accounts.json")),
      files: Object.fromEntries(Object.values(driveFiles).map((f) => [f.id, f])),
      searchByAccount: readDirByName(join(dir, "google-drive", "search"), readJson),
    },
    slack: {
      channels: readJson(join(dir, "slack", "channels.json")),
      historyByAccount: readDirByName(join(dir, "slack", "history"), readObject<SlackHistory>),
    },
    gong: {
      callsByAccount: readDirByName(join(dir, "gong", "calls"), readObject<GongCalls>),
      transcripts: readDirByName(join(dir, "gong", "transcripts"), readJson),
    },
  };
}
