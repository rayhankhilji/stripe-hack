#!/usr/bin/env node
// Rejects common agent slop in changed (or all) source files.
// Usage: node scripts/check-slop.mjs [--all] [--card <ID>] | --self-test
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { loadCard } from "./lib/cards.mjs";

const BASE = process.env.BASE_REF ?? "origin/claude/vibrant-davinci-ck0mdw";
const args = process.argv.slice(2);

// Built from fragments so this file does not flag itself.
const MARKERS = ["TO" + "DO", "FIX" + "ME", "X" + "XX", "T" + "BD", "HA" + "CK:"];

const RULES = [
  { id: "marker", re: new RegExp(`\\b(${MARKERS.join("|")})\\b`), files: /\.(ts|tsx|js|mjs|css|md|sql|ya?ml)$/ },
  { id: "lorem", re: /lorem ipsum/i, files: /./ },
  { id: "console-log", re: /\bconsole\.(log|debug)\(/, files: /^(apps|packages)\/.*\.(ts|tsx)$/ },
  { id: "any", re: /(:\s*any\b|\bas any\b|<any>)/, files: /\.(ts|tsx)$/ },
  { id: "ts-ignore", re: /@ts-(ignore|nocheck)/, files: /\.(ts|tsx)$/ },
  { id: "focused-or-skipped-test", re: /\b(it|test|describe)\.(only|skip|todo)\(/, files: /\.(test|spec)\.(ts|tsx)$/ },
  { id: "not-implemented", re: /\bnotImplemented\(|NotImplementedError/, files: /\.(ts|tsx)$/, allowWaves: ["WE", "W0"] },
  { id: "raw-hex", re: /#[0-9a-fA-F]{3,8}\b/, files: /^apps\/web\/src\/(?!styles\/globals\.css).*\.(ts|tsx|css)$/ },
  { id: "arbitrary-px", re: /\b[a-z-]+-\[\d+px\]/, files: /^apps\/web\/src\/.*\.tsx$/ },
  { id: "live-stripe-key", re: /\b(sk|rk)_live_[0-9a-zA-Z]+/, files: /./ },
  { id: "secret-literal", re: /\b(sk_test_[0-9a-zA-Z]{16,}|whsec_[0-9a-zA-Z]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/, files: /./ },
];

const IGNORE = /^(docs\/era\/tool-catalog\/|fixtures\/|pnpm-lock\.yaml$|scripts\/check-slop\.mjs$)/;

function files() {
  const cmd = args.includes("--all") ? "git ls-files" : `git diff --name-only --diff-filter=AM ${BASE}...HEAD`;
  return execSync(cmd, { encoding: "utf8" }).split("\n").filter((f) => f && !IGNORE.test(f) && existsSync(f));
}

function scan(paths, wave) {
  const hits = [];
  for (const path of paths) {
    const lines = readFileSync(path, "utf8").split("\n");
    for (const rule of RULES) {
      if (!rule.files.test(path)) continue;
      if (rule.allowWaves && wave && rule.allowWaves.includes(wave)) continue;
      lines.forEach((line, i) => {
        if (rule.re.test(line)) hits.push(`${path}:${i + 1} [${rule.id}] ${line.trim().slice(0, 120)}`);
      });
    }
  }
  return hits;
}

function selfTest() {
  const probe = (rule, text) => RULES.find((r) => r.id === rule).re.test(text);
  const expect = [
    ["any", "const x: any = 1", true],
    ["any", "const company = 1", false],
    ["raw-hex", "color: '#052018'", true],
    ["console-log", "console.log(x)", true],
    ["focused-or-skipped-test", "it.only('x')", true],
    ["marker", "// " + MARKERS[0] + " later", true],
  ];
  for (const [rule, text, want] of expect) {
    if (probe(rule, text) !== want) {
      console.error(`✖ self-test ${rule} on "${text}" expected ${want}`);
      process.exit(1);
    }
  }
  console.log("check-slop self-test ok");
}

if (args.includes("--self-test")) selfTest();
else {
  const i = args.indexOf("--card");
  const wave = i !== -1 ? loadCard(args[i + 1]).wave : undefined;
  const hits = scan(files(), wave);
  if (hits.length) {
    console.error(`✖ slop found (${hits.length}):\n  ${hits.join("\n  ")}`);
    process.exit(1);
  }
  console.log("slop check ok");
}
