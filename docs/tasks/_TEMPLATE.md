---
id: P1.T0              # phase.task; branch = gl/<id>
title: Imperative task title
wave: W1               # WE | W0 | W1 | W2 | W3 | W4
model: sonnet          # opus | sonnet | haiku  (never fable)
effort: high           # low | medium | high | xhigh
depends_on: []         # card ids that must be merged first
features: []           # F-xx from docs/PRD.md
tests: []              # T-Fxx-ACn from docs/TESTING_GUIDE.md §6
owns: []               # globs this card may create/modify (disjoint from every other card in the wave)
reads: []              # doc sections / files to read first
must_not_touch: []     # explicit reminders (frozen contracts, neighbours' files)
est: 2h                # agent wall-clock
---

# P1.T0 — Imperative task title

## Goal
What this delivers and why it matters for the demo (2–4 sentences).

## Inputs
Contracts, fixtures and services this card consumes, with paths.

## Interface to implement
Exact exported signatures, routes or components. Copy them from the frozen contracts; do not invent.

## Rules
Card-specific constraints (determinism, idempotency, states, tokens…).

## Acceptance criteria
- T-Fxx-ACn — Given … When … Then …

## Verify
```bash
pnpm typecheck && pnpm lint
pnpm test --filter <package>
pnpm check:ownership --card P1.T0 && pnpm check:slop
```

## Delegation
Optional: sub-steps to hand to cheaper subagents (model + effort) and how to check their output.

## Definition of done
- [ ] All acceptance criteria pass with the listed tests
- [ ] Verify commands green; output pasted in the PR
- [ ] Only `owns` files touched; no contract edits (CCR filed if needed)
- [ ] Reviewer rubric (docs/fleet/REVIEWER.md) self-check done

## Not done if
Specific failure conditions a reviewer will reject on.
