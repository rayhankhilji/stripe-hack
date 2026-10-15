# Ghost — 2-minute demo script

Hero case: **Tidewater Capital** (`acct-6`). Three Closed Won deals were never billed. Ghost finds $72,200, shows the evidence, waits for a human, creates a Stripe test-mode invoice, and marks the case recovered only after a verified `invoice.paid` webhook.

Every number below is checked against `fixtures/era/salesforce/*.json`. Button labels come from the UI card specs (U2 Workspace, U3 Recovery case). If the shipped wording differs, click the same control.

---

## 1. Pre-flight (run 5 minutes before going live)

- [ ] `pnpm demo:reset` finished without error.
- [ ] `stripe listen --forward-to localhost:3000/api/stripe/webhook` is running, and its `whsec_…` is in `STRIPE_WEBHOOK_SECRET`. `pnpm dev` was started after that.
- [ ] `pnpm dev` is up at http://localhost:3000 and you are signed in with `OPERATOR_PASSWORD`.
- [ ] The Workspace shows **Tidewater Capital, $72,200** as a top opportunity, with status **Ready for approval**. If it does not, stop and run `pnpm demo:reset` again.
- [ ] Test card ready: **4242 4242 4242 4242**, any future expiry (e.g. `12/34`), any CVC (e.g. `123`), any ZIP (e.g. `10001`).
- [ ] Only the Ghost tab and the Stripe payment tab are open. Close anything that shows real customer or email data.

---

## 2. The numbers (know these cold)

### Deals (Salesforce Opportunities, `opportunities.json`)

| Deal | Name | Stage | Amount | Close date | Order (`orders.json`) | Order status | Lines (`opportunity_line_items.json`) |
|---|---|---|---|---|---|---|---|
| `deal-127` | Tidewater Capital - Pilot | Closed Won | $51,500 | 2024-09-12 | `order-127` (No. 00000128) | Draft | `oli-deal-127-0` Audit Evidence Pack $16,400 + `oli-deal-127-1` Regulatory Reporting $35,100 |
| `deal-23` | Tidewater Capital - Platform | Closed Won | $11,000 | 2026-07-27 | `order-23` (No. 00000024) | Draft | `oli-deal-23-0` Audit Evidence Pack $11,000 |
| `deal-24` | Tidewater Capital - Renewal FY26 | Closed Won | $9,700 | 2026-09-19 | `order-24` (No. 00000025) | Draft | `oli-deal-24-0` Audit Evidence Pack $9,700 |

**Total: $51,500 + $11,000 + $9,700 = $72,200, across 4 invoice lines.**

### Contract (`contracts.json`)

- `contract-4` (No. 00000005), status **In Approval Process**, no activated date.
- Description: "Business plan for Tidewater Capital: 20 seats at 9,700 per year."
- Special terms: "12-month term, annual invoicing in advance."

### Not in the number (use this if asked)

- `deal-22` "Tidewater Capital - Renewal", **$85,000**, stage Prospecting, open. It is not won, so Ghost does not count it.

### Identity (R-01)

- Salesforce account `acct-6`, Tidewater Capital, Financial Services, 600 employees.
- The same customer also appears in the Zendesk organization (`external_id` `acct-6`), Slack, Gong, Google Drive and AWS fixtures.

### What the rules say

- R-10 **warns**, because `contract-4` is not activated. The case therefore needs a human approval.
- Ghost never approves or pays on its own. `AUTO_INVOICE_ENABLED=false`.

---

## 3. The 2-minute run

| Time | Screen | Click | Say |
|---|---|---|---|
| **0:00–0:15** | Workspace `/` | Nothing yet. Let the top opportunity sit on screen. | "Ghost is an AI revenue operator. Sapora Networks closed **$72,200** of business with Tidewater Capital and never invoiced it. Ghost found it, and it won't move money without a person." |
| **0:15–0:30** | Workspace `/` | Click **Hunt for leaks**. Watch the activity stream. | "Detection is deterministic. It rechecks every customer against the same rules. It finds nothing new, because this case is already in the queue." |
| **0:30–0:45** | Recovery case `/recovery/[id]` | Click the **Tidewater Capital $72,200** card. | "This is the case. The big number is $72,200. The status is *Ready for approval*, and the sentence under it is the reason." |
| **0:45–1:00** | Calculation table | Scroll to it. Point at the four lines. | "Four lines across three closed-won deals. $16,400 plus $35,100 is the $51,500 pilot. Then $11,000 for the platform and $9,700 for the renewal. Total $72,200. Nothing here is generated; it is arithmetic, with a hash you can reproduce." |
| **1:00–1:12** | Evidence list and eligibility | Click the **contract-4** source chip. Point at the **R-10** row. | "Here is the contract. It says '20 seats at 9,700 per year' and it is still *In Approval Process*. The orders are Draft in Salesforce. R-10 warns, so a human has to sign off." |
| **1:12–1:25** | Action panel | Click **Approve & create Stripe invoice**. In the dialog, read the amount and the R-10 warning, then confirm. | "Approval creates a real Stripe invoice. This is test mode only. The card is a test card, and no real email leaves the building." |
| **1:25–1:35** | Invoice panel | Wait for the Stripe number to appear. Click **Open payment page** (opens a new tab). | "Ghost now shows the Stripe invoice number and the four lines. It is waiting for Stripe to confirm payment." |
| **1:35–1:50** | Stripe hosted page | Enter **4242 4242 4242 4242**, the future expiry, CVC and ZIP. Click **Pay**. | "The operator pays on Stripe's own page. Ghost does not trust the redirect back to its app." |
| **1:50–2:00** | Back to Ghost | Switch tabs. Wait for the panel to change. | "The webhook came in, Stripe's signature checked out, and the case is recovered: **$72,200, verified by Stripe webhook**. Every step is in the audit trail." |

Total: 2:00.

---

## 4. If something goes wrong on stage

| Symptom | What to do |
|---|---|
| Webhook has not arrived after about 10 seconds | Look at the `stripe listen` terminal. If the event is listed and returned 200, wait a few more seconds. If it is not listed, click **Refresh from Stripe**. That fetches the invoice from the Stripe API, which is authoritative. Say what you see. Do not say "verified by webhook" if it was not. |
| Explanation text reads like a template | `OPENAI_API_KEY` is unset, so Ghost uses its deterministic template explainer. Say so: "This is the deterministic explainer. With a model key it writes prose, with citations to the same records." |
| Workspace shows no Tidewater case | Run `pnpm demo:reset`, then reload. |
| Ghost refuses to create the invoice | `STRIPE_SECRET_KEY` must start with `sk_test_`. Fix the key and restart `pnpm dev`. |
| Context panel is thin | Cognee is down. Search falls back to Postgres full-text search over the same records. Keep the script; the numbers do not depend on Cognee. |

---

## 5. Closing line (if you have 10 seconds to spare)

"Every number is traceable to a Salesforce record. The money moves only after a human approves, and the case closes only after Stripe says it's paid."
