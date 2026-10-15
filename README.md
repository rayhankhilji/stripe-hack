# Ghost

Ghost is an agent-first revenue operator. It reads a synthetic company's records (Sapora Networks, across Salesforce, Zendesk, Slack, Gong, Google Drive and AWS), finds revenue that was earned but never invoiced, and creates a **Stripe test-mode** invoice after a human approves it. It marks a case recovered only from a verified `invoice.paid` webhook, and it records every step in an audit trail.

**Hero case:** Tidewater Capital (`acct-6`). Three Closed Won deals, $72,200 in total, with Draft orders and a contract still in approval. The full walkthrough is in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

> Demo data is synthetic and recorded. Fixture records carry a visible **DEMO FIXTURE** badge.

## What it does

1. **Ingest.** Loads Era records from `fixtures/era/**` (or live from Era) and resolves each customer across systems.
2. **Detect.** A deterministic detector looks for closed-won revenue that was never billed, then checks eligibility rules R-01 to R-10.
3. **Explain.** An agent (Mastra with OpenAI) writes the case with citations to source records. Numbers are copied only from the deterministic calculation. With no OpenAI key it uses a template explainer, never invented prose.
4. **Approve.** A human approves the case. Ghost never invoices on its own (`AUTO_INVOICE_ENABLED=false`).
5. **Invoice.** Ghost creates a real Stripe test-mode invoice. The operator pays on Stripe's hosted page with the test card `4242 4242 4242 4242`.
6. **Verify.** A signed `invoice.paid` webhook marks the case `recovered` and stops collection reminders. Ghost never marks anything paid from a redirect or from model output.
7. **Audit.** Every state change is written to `audit_event`, and the UI shows that feed as the agent's live activity.

Safety rails:

- Stripe is **test mode only**. Keys must start with `sk_test_` / `pk_test_`, or the app refuses to start the Stripe client.
- All outbound email goes to the outbox and is "sent" only to `@sandbox.ghost.test`.
- Card numbers and tokens are redacted before logging.

## Repository layout

```text
apps/web/          Next.js 16 app: UI, JSON API under /api/v1, Stripe webhook
packages/shared/   zod contracts, money and error helpers, env validation
packages/db/       Drizzle schema, migrations, database client
packages/era/      Era MCP client (live) and fixture loader
packages/ingest/   Era → database ingest (idempotent)
packages/knowledge/ Cognee client with Postgres full-text fallback
packages/billing/  Pure billing engine: detection, eligibility, decision
packages/stripe/   Stripe client, customers, invoices, webhook verification
packages/core/     Domain services: findings, approvals, audit, collections, outbox
packages/agents/   Mastra workflows and agents
fixtures/era/      Recorded Era data (redacted, never hand-edited)
services/cognee/   Docker Compose for the Cognee REST server (optional)
scripts/           demo-reset, ownership and slop checks
docs/              Specs, the 3-hour build contract, cards, and the demo script
```

## Setup

### Prerequisites

- Node.js 22 or newer
- pnpm 10.28.0 (`corepack enable`, or `npm i -g pnpm@10.28.0`)
- Stripe CLI, signed in to a Stripe **test** account (`stripe login`)
- Docker, only if you want Cognee knowledge search. Without it, search falls back to Postgres full-text.
- A Postgres database (Supabase) if you want to use one. If `DATABASE_URL` is unset, the app uses a local PGlite database in `./.data/pglite`.

### 1. Install

```bash
pnpm install
```

### 2. Set environment variables

`.env.example` lists every variable with fake values. Do not commit real values. Set them in your shell, or in a local `.env` (git-ignores `.env*`).

Required for the demo:

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` from your Stripe test account |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` printed by `stripe listen` (step 4) |
| `OPERATOR_PASSWORD` | Password for the operator login |
| `SESSION_SECRET` | 32 or more random characters |
| `DEMO_MODE` | `true` (enables `POST /api/v1/demo/reset`) |
| `AUTO_INVOICE_ENABLED` | `false` (every invoice needs a human) |

Optional:

| Variable | Effect when unset |
|---|---|
| `OPENAI_API_KEY` | Uses the deterministic template explainer instead of a model |
| `DATABASE_URL` | Uses local PGlite in `./.data/pglite` |
| `COGNEE_BASE_URL` | Knowledge search uses Postgres full-text |
| `ERA_*` | Only needed for live ingest (`pnpm ingest`). The demo runs from fixtures. |

### 3. Load the demo data

```bash
pnpm demo:reset
```

This resets the database, applies migrations, ingests the fixtures, runs detection and the expansion scan. When it finishes, Tidewater Capital should show as a $72,200 finding.

To use Cognee, start it first, then reset:

```bash
docker compose -f services/cognee/docker-compose.yml up -d
pnpm demo:reset
```

### 4. Start the Stripe webhook listener

Run this in its own terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_…` value it prints into `STRIPE_WEBHOOK_SECRET`. Then start the app, so it reads the secret.

### 5. Start the app

```bash
pnpm dev
```

Open http://localhost:3000 and sign in with `OPERATOR_PASSWORD`.

### 6. Check it

- The Workspace shows **Tidewater Capital, $72,200**, with status ready for approval.
- Opening the case shows four lines that add up to $72,200.

If that is right, follow [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Test card

Use these values on Stripe's hosted payment page. They work only in test mode.

| Field | Value |
|---|---|
| Card number | `4242 4242 4242 4242` |
| Expiry | any future date, e.g. `12/34` |
| CVC | any three digits, e.g. `123` |
| ZIP | any, e.g. `10001` |

## Commands

| Purpose | Command |
|---|---|
| Install | `pnpm install` |
| Dev server | `pnpm dev` (http://localhost:3000) |
| Reset and seed the demo | `pnpm demo:reset` |
| Ingest from fixtures | `pnpm ingest --from-fixtures` |
| Ingest live from Era | `pnpm ingest` |
| Typecheck · lint | `pnpm typecheck` · `pnpm lint` |
| Unit and integration tests | `pnpm test` |
| End-to-end tests (needs `pnpm dev`) | `pnpm test:e2e` |
| Build | `pnpm build` |

## Troubleshooting

| Problem | Fix |
|---|---|
| Workspace is empty after `pnpm demo:reset` | Check the terminal for errors, then run `pnpm demo:reset` again. |
| Paying the invoice does not update the case | Check that `stripe listen` is running, that `STRIPE_WEBHOOK_SECRET` matches the `whsec_…` it printed, and that `pnpm dev` was restarted after you set it. |
| Stripe client refuses to start | The key must start with `sk_test_`. Live keys are rejected on purpose. |
| Explanation is plain template text | `OPENAI_API_KEY` is unset. This is expected without a key. |
| Knowledge search is thin | Cognee is not running. Start it, then `pnpm demo:reset`. |

## Safety

- Test mode only. No live Stripe keys, no real charges.
- No real email. The outbox simulates sending to `@sandbox.ghost.test`.
- The data is synthetic. Treat any real-looking customer, card or email as a bug.
