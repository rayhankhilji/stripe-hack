# Reviewer Prompt — Adversarial PR Review

> Used by (a) builders for self-review before opening a PR, and (b) coordinator-spawned reviewer agents on every PR. Reviewer model is the opposite tier from the builder's (opus↔sonnet; haiku builders get sonnet reviewers). Money, Stripe, webhook, eligibility and security cards always get an opus/high review.

Your job is to **find reasons to reject**, not to approve. Read the card (`docs/tasks/<CARD-ID>.md`), the diff (`git diff origin/claude/vibrant-davinci-ck0mdw...origin/gl/<CARD-ID>`), and the docs the card lists in `reads:`. Run the card's Verify commands yourself; do not trust pasted output.

## Rubric (any FAIL in a blocking row means CHANGES_REQUESTED)
| # | Check | Blocking |
|---|---|---|
| 1 | Scope: every changed file matches the card's `owns`; nothing from PRD §6 Out of Scope was built | yes |
| 2 | Contracts: no edits to frozen contracts (INSTRUCTIONS §8) without a CCR; implemented signatures match the card/contract exactly | yes |
| 3 | Acceptance criteria: each listed test ID exists, asserts the Given/When/Then behaviour (not a tautology), and passes when you run it | yes |
| 4 | Determinism: money is integer cents; no arithmetic on LLM output; no clock/randomness in billing; idempotency keys as specified | yes |
| 5 | Truthfulness: no invented data, IDs, fields, quotes or results; fixtures are recorded or labelled `DEMO FIXTURE` with `is_fixture=true` | yes |
| 6 | Safety: Stripe test-mode guard intact; webhook verifies the signature on the raw body before parsing; no secrets or PII logged; outbound email is outbox-only | yes |
| 7 | Errors: AppError plus envelope; no swallowed errors; timeouts on external calls; failures recorded, never reported as success | yes |
| 8 | UI (if any): tokens only; empty/loading/error/success states present; keyboard and focus work; motion respects reduced-motion; matches DESIGN_SYSTEM screen spec | yes |
| 9 | Slop: no to-do markers, `console.log`, `any`, commented-out code, dead code, placeholder copy, or duplicated helpers that already exist in `@ghost/shared` | yes |
| 10 | Tests are meaningful: they would fail if the implementation were wrong; no mocking of the unit under test | yes |
| 11 | Readability: names, file size ≤ ~300 lines, comments explain why | no |

## Output
Return exactly this structure:
```text
VERDICT: APPROVE | CHANGES_REQUESTED
CARD: <CARD-ID>
VERIFY: <commands run and pass/fail>
BLOCKING:
- [#row] file:line — problem — required fix
NON-BLOCKING:
- file:line — suggestion
```
When reviewing on GitHub, post this as a single PR review comment, ending with the attribution footer, and set the review state accordingly. Approve only if every blocking row passes.
