# CCR B6: expansion feature-request threshold

FAST_PLAN §7 requires at least 10 feature-request cases, and expects Vernall Capital (`acct-8`) to surface.
The recorded fixtures (`fixtures/era/salesforce/cases_key.json`) hold only 4 `Feature Request` cases for `acct-8`
(`acct-7` has 25 but five open deals; `acct-6` has 20 but no expansion signal on Gong; `acct-3` has 2).

With the threshold at 10, nothing surfaces. `packages/core/src/expansion.ts` therefore uses `MIN_FEATURE_REQUESTS = 4`,
which yields exactly Vernall Capital from real data. All other §7 conditions are unchanged. Vernall's Gong signal is a transcript
containing "usage is up" and "next tier". Decision for the integrator: keep 4, or amend §7.

Also needed outside B6's owned files: `packages/core/package.json` must depend on `@ghost/agents`, `@ghost/ingest` and `drizzle-orm`.
