#!/usr/bin/env node
// Fails when a branch touches files outside its task card's `owns` globs, or when cards in one wave overlap.
// Usage:
//   node scripts/check-ownership.mjs --card P1.T7          (diff vs $BASE_REF, default origin/claude/vibrant-davinci-ck0mdw)
//   node scripts/check-ownership.mjs --disjoint            (every wave: owns globs pairwise disjoint)
//   node scripts/check-ownership.mjs --self-test
import { execSync } from "node:child_process";
import { loadCard, loadAllCards, matchesAny, globsMayOverlap, globToRegExp } from "./lib/cards.mjs";

const BASE = process.env.BASE_REF ?? "origin/claude/vibrant-davinci-ck0mdw";
const args = process.argv.slice(2);

function changedFiles() {
  const out = execSync(`git diff --name-only ${BASE}...HEAD`, { encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

function checkCard(id) {
  const card = loadCard(id);
  const owns = card.owns ?? [];
  if (owns.length === 0) fail(`card ${id} declares no owns globs`);
  const allowed = [...owns, `docs/ccr/${id}-*.md`];
  const offenders = changedFiles().filter((f) => !matchesAny(f, allowed));
  if (offenders.length) {
    fail(`card ${id} touched files outside its owns globs:\n  ${offenders.join("\n  ")}\nFile a CCR (INSTRUCTIONS.md §8) instead of editing these.`);
  }
  console.log(`ownership ok: ${id}`);
}

function checkDisjoint() {
  const byWave = new Map();
  for (const c of loadAllCards()) {
    const list = byWave.get(c.wave) ?? [];
    list.push(c);
    byWave.set(c.wave, list);
  }
  const clashes = [];
  for (const [wave, cards] of byWave) {
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        for (const a of cards[i].owns ?? []) {
          for (const b of cards[j].owns ?? []) {
            if (globsMayOverlap(a, b)) clashes.push(`${wave}: ${cards[i].id} "${a}" ↔ ${cards[j].id} "${b}"`);
          }
        }
      }
    }
  }
  if (clashes.length) fail(`overlapping ownership:\n  ${clashes.join("\n  ")}`);
  console.log(`ownership disjoint across ${byWave.size} waves`);
}

function selfTest() {
  const cases = [
    ["packages/billing/src/**", "packages/billing/src/detectors/won.ts", true],
    ["packages/billing/src/*.ts", "packages/billing/src/detectors/won.ts", false],
    ["apps/web/src/app/(app)/recovery/**", "apps/web/src/app/(app)/recovery/[findingId]/page.tsx", true],
    ["packages/*/src/index.ts", "packages/db/src/index.ts", true],
    ["fixtures/era/{slack,gong}/**", "fixtures/era/gong/calls.json", true],
  ];
  for (const [glob, path, want] of cases) {
    const got = globToRegExp(glob).test(path);
    if (got !== want) fail(`self-test: ${glob} vs ${path} expected ${want} got ${got}`);
  }
  if (!globsMayOverlap("packages/billing/src/**", "packages/billing/src/hash.ts")) fail("self-test: overlap missed");
  if (globsMayOverlap("packages/billing/src/**", "packages/stripe/src/**")) fail("self-test: false overlap");
  console.log("check-ownership self-test ok");
}

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

if (args.includes("--self-test")) selfTest();
else if (args.includes("--disjoint")) checkDisjoint();
else {
  const i = args.indexOf("--card");
  if (i === -1 || !args[i + 1]) fail("usage: check-ownership.mjs --card <CARD-ID> | --disjoint | --self-test");
  checkCard(args[i + 1]);
}
