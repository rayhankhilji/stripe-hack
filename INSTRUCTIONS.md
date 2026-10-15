# Agent Instructions — Ghost

> Version 1.0 · Updated 2026-10-15 · Applies to every agent session (builder, reviewer, integrator, coordinator).

## 0. Read Order
1. This file (all of it).
2. Your task card: `docs/tasks/<CARD-ID>.md`. It is your contract. If you have no card, you are not a builder. Read `docs/fleet/` for your role.
3. `docs/TASK_LOG.md` Status block (read-only for builders).
4. Only the doc sections your card lists under `reads:`. Typical: `docs/ARCHITECTURE.md` §5 (API), `docs/DATA_MODEL.md`, `docs/AGENT_WORKFLOWS.md`, `docs/STRIPE_INTEGRATION.md`, `docs/ERA_INTEGRATION.md`.
5. `docs/DESIGN_SYSTEM.md` before touching anything under `apps/web/src/` or `public/`.
6. `docs/EVAL_GUARDRAILS.md` §1 (Definition of Done) and `docs/SECURITY_AND_GUARDRAILS.md` before you open a PR.

## 1. Mission
Ghost is an agent-first AI revenue operator. It reconciles a synthetic company's records (Era: Salesforce, Google Drive, Slack, Gong, Jira/Confluence, Zendesk, AWS), finds revenue that was earned but never invoiced, and creates a real Stripe **test-mode** invoice after human approval. It confirms payment only from a verified Stripe webhook and records every step in an audit trail. The quality bar is a product a finance team would trust: every number is deterministic and every claim cites a source record.

## 2. Operating Loop (builders)
You run as one of many parallel agents. Other agents are editing other files right now, so stay inside your card.
1. Read your card. Restate its goal, `owns`, interface and acceptance criteria to yourself.
2. Confirm every `depends_on` card is merged: `git log --oneline | grep <CARD-ID>`. If one is missing, stop and report `BLOCKED: dependency <ID> not merged` in your PR or final message.
3. Plan the files you will touch. **They must all match your card's `owns` globs.** Tests for your code live inside your owned paths.
4. Implement in small commits: `<type>(<CARD-ID>): <summary>` (Conventional Commits).
5. Run the fast loop: `pnpm typecheck && pnpm lint && pnpm test --filter <your package>`. Then run every command in your card's **Verify** section.
6. Delegate mechanical sub-work to cheaper subagents when your card says so (e.g. `Agent(model: haiku, effort: low)` for fixture or test boilerplate). Review what they produce; you own it.
7. Self-review the diff with a reviewer subagent, using the rubric in `docs/fleet/REVIEWER.md`.
8. Run `pnpm check:ownership --card <CARD-ID>` and `pnpm check:slop`. Both must pass.
9. Push branch `gl/<CARD-ID>` and open a PR into `claude/vibrant-davinci-ck0mdw`. Use the PR template, with the session log in the body.
10. Stop. Do not start another card. The coordinator assigns work.

## 3. Tech Stack (locked)
| Layer | Choice |
|---|---|
| Runtime / package manager | Node ≥ 22 (the build containers ship 22; 24 LTS is fine), pnpm 10.28 workspaces (no Turborepo); `packageManager: pnpm@10.28.0` |
| Web | Next.js 16 App Router, React 19, TypeScript 5.9 strict (not TS 7: tooling compatibility) |
| Styling / UI | Tailwind CSS 4 with tokens in `apps/web/src/styles/globals.css`; Radix primitives; Motion; Lucide icons; Geist, Geist Mono and Fraunces fonts |
| Data | Supabase Postgres via Drizzle ORM 0.45 + drizzle-kit; PGlite for tests |
| Validation | zod 4. Shared contracts live in `packages/shared` |
| Agents | @mastra/core 1.x workflows, tools and agents; @mastra/pg PostgresStore; OpenAI via AI SDK v7 (`@ai-sdk/openai`) |
| Knowledge | Cognee REST server (Docker image `cognee/cognee`), called only from `packages/knowledge` |
| Era | `@modelcontextprotocol/sdk` Client + StreamableHTTPClientTransport, only from `packages/era` |
| Payments | `stripe` 23.x, pinned API version `2026-09-30.endive`, test mode only |
| Client data | TanStack Query 5 |
| Tests | Vitest 5, Testing Library, Playwright 1.64, MSW 3 |

Do not add a framework, library or service that is not listed above unless your card names it. If you believe one is needed, file a Contract Change Request (§8).

## 4. Repository Structure
```text
apps/web/                       Next.js app (UI + route handlers + webhook)
  src/app/(auth)/login/         operator password gate
  src/app/(app)/                authenticated app; one folder per route (see ARCHITECTURE §7)
  src/app/api/v1/**/route.ts    JSON API (ARCHITECTURE §5). Thin: parse → core service → envelope
  src/app/api/stripe/webhook/   Stripe webhook (raw body, Node runtime)
  src/components/ui/            primitives (Button, Badge, Table, Dialog…)
  src/components/ghost/         brand components (Logo, SourceChip, ActivityStream, EvidenceGraph…)
  src/features/<screen>/        screen-specific components, one folder per screen
  src/lib/queries/              TanStack Query hooks, one file per resource
  src/lib/format/               money, number, date formatters
  src/server/                   server-only helpers (handler wrapper, session, env)
  src/styles/globals.css        design tokens (the ONLY place raw colour values live)
packages/shared/src/            zod contracts (contracts/*.ts), errors.ts, money.ts, ids.ts, env.ts
packages/db/src/                schema/*.ts, migrations/, client.ts, repos/*.ts, testing/pglite.ts
packages/era/src/               token.ts, client.ts, adapters/<system>.ts, normalize/<system>.ts
packages/ingest/src/            run.ts, upsert.ts, identity.ts, redact.ts, documents.ts, cli.ts
packages/knowledge/src/         cognee.ts, fts.ts, index.ts (KnowledgeService)
packages/billing/src/           pure, deterministic: money, detectors/, ledger-check.ts, eligibility/, hash.ts
packages/stripe/src/            client.ts, customers.ts, invoices.ts, webhooks.ts, reconcile.ts
packages/core/src/              domain services: findings, approvals, audit, collections, expansion, outbox, overview
packages/agents/src/            mastra.ts, models.ts, tools/, agents/, workflows/, prompts/*.md
services/cognee/                docker-compose.yml + env template for the Cognee server
fixtures/                       era/<system>/*.json, stripe/events/*.json, llm/*.json (recorded, never edited by hand)
e2e/                            Playwright specs
scripts/                        check-ownership.mjs, check-slop.mjs, check-docs.mjs, demo-reset.ts
docs/                           all specs; docs/tasks/ = cards; docs/fleet/ = role prompts
```
Rules:
- **Dependency direction** (enforced by lint): `web → core, agents → db, billing, stripe, knowledge, shared`; `ingest → era, db, knowledge, shared`. `billing` and `shared` import nothing internal except `shared`. Nothing imports `apps/web`.
- Files use kebab-case; React components use PascalCase exports; there is one component per file.
- No barrel files except each package's `src/index.ts`, which is the public API frozen at `contracts-v1`.
- Prompts live in `packages/agents/src/prompts/*.md` with a version header. Never inline prompt strings.
- Fixtures live in `fixtures/` and are produced by recorder scripts. Never hand-edit recorded data.

## 5. Commands
| Purpose | Command |
|---|---|
| Install | `pnpm install` |
| Dev (web) | `pnpm dev` (http://localhost:3000) |
| Cognee locally | `docker compose -f services/cognee/docker-compose.yml up -d` |
| Stripe webhooks locally | `stripe listen --forward-to localhost:3000/api/stripe/webhook` |
| Typecheck | `pnpm typecheck` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Unit + integration tests | `pnpm test` (all) · `pnpm test --filter @ghost/billing` (one package) |
| E2E | `pnpm test:e2e` (requires `pnpm dev` and env) |
| DB migrate / generate | `pnpm db:generate` (after schema change) · `pnpm db:migrate` |
| Seed / reset demo | `pnpm demo:reset` |
| Ingest from Era | `pnpm ingest` (live) · `pnpm ingest --from-fixtures` |
| Record Era fixtures | `pnpm era:record` |
| Guards | `pnpm check:ownership --card <ID>` · `pnpm check:slop` · `pnpm check:docs` |
| Build | `pnpm build` |

## 6. Coding Standards
- TypeScript `strict`, `noUncheckedIndexedAccess`. No `any`. No `!` non-null assertion without a one-line reason comment.
- **Money is integer cents (`bigint` in DB, `number` safe-integer in TS, validated ≤ 2^53).** Never use floats for money. Use helpers from `@ghost/shared/money`.
- All external input is validated with `@ghost/shared` zod schemas at the boundary: HTTP, MCP results, Stripe objects, LLM output.
- Errors: throw `AppError(code, message, details?)` from `@ghost/shared/errors`. Route handlers convert it to the envelope. Never swallow errors; never `catch {}`.
- Every external call has a timeout (`AbortSignal.timeout(ms)`): Era 20s, Cognee 30s, Stripe 15s, OpenAI 60s.
- No floating promises. Keep functions small and use early returns. Comments explain *why*. Files have a soft limit of 300 lines.
- Data access goes only through `packages/db/src/repos/*`. No raw SQL outside `packages/db`.

```ts
// DO: deterministic, typed, cites inputs
const total = sumCents(lines.map((l) => l.totalCents)); // exact integer arithmetic
if (total !== deal.amountCents) return fail("R-03", { total, expected: deal.amountCents });

// DON'T: model-derived numbers or floats
const total = Number(llmOutput.amount) * 1.0; // never: amounts come from source records only
```

## 7. Frontend and Backend Rules
- UI uses design tokens only (CSS variables / Tailwind theme). Raw hex or arbitrary px values in components fail `check:slop`.
- Every screen implements empty, loading, error and success states, plus partial states where the DESIGN_SYSTEM spec lists them.
- Fetch only through `apps/web/src/lib/queries/*` hooks, which call routes listed in ARCHITECTURE §5. Never call an unlisted endpoint.
- Every route handler is wrapped in `withHandler()` (session check, zod parse, request ID, error envelope). The only exceptions are `/api/stripe/webhook`, `/api/auth/*` and `/api/health`.
- The webhook verifies the Stripe signature against the raw body **before** parsing anything.
- Side-effecting operations are idempotent, with keys defined in STRIPE_INTEGRATION and DATA_MODEL uniqueness constraints.
- LLM calls only happen inside `packages/agents`. They return zod-validated structured output; numbers in LLM output are never used for arithmetic.

## 8. File Ownership and Contract Changes
- You may create or modify only files matching your card's `owns` globs. CI (`check:ownership`) rejects anything else.
- **Frozen contracts** (after tag `contracts-v1`) are: `packages/shared/src/**`, `packages/db/src/schema/**`, `packages/db/src/migrations/**`, every `packages/*/src/index.ts`, `apps/web/src/styles/globals.css`, `docs/ARCHITECTURE.md` §5 and `docs/DATA_MODEL.md`.
- If you need a contract change, do not edit the contract. Instead:
  1. Write `docs/ccr/<CARD-ID>-<slug>.md` (allowed for every card): what changes, why, and the exact diff.
  2. Open the PR with label `ccr` and stop. The integrator decides and broadcasts.
- Never edit `docs/TASK_LOG.md`, `docs/ROADMAP.md` or another card's files. Put your session notes in the PR body.

## 9. Prohibited
| Do not | Why / instead |
|---|---|
| Use live Stripe keys or call Stripe without `sk_test_` | Guard `assertTestMode()` in `packages/stripe/src/client.ts` |
| Mark anything paid from a redirect, success page or model output | Only a verified webhook or a Stripe API fetch sets `paid` |
| Invent customers, amounts, terms, quotes or evidence | Unknown means `needs_review`. Synthetic demo data must carry `is_fixture=true` and a visible `DEMO FIXTURE` badge |
| Send real email | All outbound mail goes to the outbox and is "sent" only to `@sandbox.ghost.test` |
| Log secrets, tokens, card numbers or raw Era payloads with PII | Use the `redact()` and `logger` helpers |
| Add packages: `moment`, `lodash`, `axios`, `request`, any CSS-in-JS, a second UI kit, a second ORM, LangChain, LangGraph, OpenAI Agents SDK | Native/listed alternatives exist; Mastra is the agent framework |
| Edit applied migrations | Add a new migration through a CCR |
| Skip, `.only`, or weaken tests to get green; mock the unit under test | Fix the code or report a blocker |
| Leave to-do markers, `console.log`, commented-out code or placeholder UI | `check:slop` fails the PR |
| Build anything in PRD §6 Out of Scope | It is a prohibition list |
| Use `Date.now()` or randomness in billing logic | Pass a clock; keep billing pure |

## 10. When Stuck
- After **two** failed attempts at the same problem, stop. Open the PR as draft titled `BLOCKED <CARD-ID>: <one line>`. The body states what you tried, the exact error output, your hypotheses and what you need.
- Never change requirements, contracts or architecture to get unstuck. Never fake a passing result.
- If a live service (Era, Cognee, Stripe, OpenAI) is unreachable, use the recorded fixtures for tests and say so in the PR. Do not invent responses.

## 11. Git and PRs
- Branch `gl/<CARD-ID>`, base `claude/vibrant-davinci-ck0mdw`. One card per branch, one PR per card.
- Commits use `<type>(<CARD-ID>): <summary>`. PR title is `<CARD-ID>: <card title>`.
- The PR body follows `.github/pull_request_template.md`: acceptance criteria and test IDs with results, verify-command output (last lines), screenshots for UI, deviations, and the session log.
- Never force-push a shared branch. Never merge your own PR.

## 12. Human Escalation
Write `NEEDS-HUMAN` in the PR title and stop for any of: a new paid service; a schema-breaking change; a security trade-off; a scope change; ambiguous acceptance criteria; anything touching real money, real email or real customer data.
