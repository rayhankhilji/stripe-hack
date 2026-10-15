// Shared helpers for the fleet guard scripts: task-card parsing and glob matching.
// Dependency-free on purpose: these scripts must run before `pnpm install` succeeds.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const TASKS_DIR = "docs/tasks";

/** Parse the YAML-ish frontmatter of a task card (scalars and inline/block string lists only). */
export function parseCard(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error("card has no frontmatter");
  const out = {};
  let listKey = null;
  for (const raw of m[1].split("\n")) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && listKey) {
      out[listKey].push(unquote(item[1].trim()));
      continue;
    }
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === "") {
      out[key] = [];
      listKey = key;
    } else if (value.startsWith("[")) {
      out[key] = value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter(Boolean);
      listKey = null;
    } else {
      out[key] = unquote(value.trim());
      listKey = null;
    }
  }
  return out;
}

function unquote(s) {
  return s.replace(/^["']|["']$/g, "");
}

export function loadCard(id) {
  const path = join(TASKS_DIR, `${id}.md`);
  if (!existsSync(path)) throw new Error(`card not found: ${path}`);
  return parseCard(readFileSync(path, "utf8"));
}

export function loadAllCards() {
  if (!existsSync(TASKS_DIR)) return [];
  return readdirSync(TASKS_DIR)
    .filter((f) => /^P\d+\.T\d+\.md$/.test(f))
    .map((f) => ({ file: f, ...parseCard(readFileSync(join(TASKS_DIR, f), "utf8")) }));
}

/** Convert a glob (`**`, `*`, `?`, `{a,b}`) to an anchored RegExp. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      re += "(?:" + glob.slice(i + 1, end).split(",").map(escape).join("|") + ")";
      i = end;
    } else re += escape(c);
  }
  return new RegExp("^" + re + "$");
}

function escape(s) {
  return s.replace(/[.+^$()|[\]\\]/g, "\\$&");
}

export function matchesAny(path, globs) {
  return globs.some((g) => globToRegExp(g).test(path));
}

/** Literal prefix of a glob up to its first wildcard. */
export function staticPrefix(glob) {
  const i = glob.search(/[*?{]/);
  return i === -1 ? glob : glob.slice(0, i);
}

/** Conservative overlap test: may report false positives, never false negatives for prefix-shaped globs. */
export function globsMayOverlap(a, b) {
  if (a === b) return true;
  const pa = staticPrefix(a);
  const pb = staticPrefix(b);
  const wa = pa !== a;
  const wb = pb !== b;
  if (!wa && !wb) return false;
  if (!wa) return globToRegExp(b).test(a);
  if (!wb) return globToRegExp(a).test(b);
  return pa.startsWith(pb) || pb.startsWith(pa);
}
