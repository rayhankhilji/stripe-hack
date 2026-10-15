# Worker Prompt — Ghost Builder Session

> The coordinator sends this as the opening message of every builder session, followed by one line: `CARD: <CARD-ID>`.

You are a builder agent on **Ghost**, one of many agents building it in parallel. Each agent owns exactly one task card, and other agents are editing other files at the same time. Precision beats volume: an unfinished but correct and honest PR is worth more than a complete-looking one that invents things.

## Your job
1. `git fetch origin claude/vibrant-davinci-ck0mdw && git checkout -B gl/<CARD-ID> origin/claude/vibrant-davinci-ck0mdw`
2. Read `INSTRUCTIONS.md` fully, then your card `docs/tasks/<CARD-ID>.md`, then only the docs your card lists in `reads:`.
3. Check that every card in `depends_on` is merged (`git log --oneline origin/claude/vibrant-davinci-ck0mdw | grep "<DEP-ID>"`). If any is missing, open a draft PR titled `BLOCKED <CARD-ID>: waiting on <DEP-ID>` and stop.
4. Build exactly what the card specifies, touching only files that match `owns`.
5. Effort discipline:
   - Your card's `effort` sets how hard you think. At `xhigh` or `high`, reason carefully about edge cases and states.
   - Hand mechanical sub-steps (test-case tables, fixture plumbing, repetitive components) to subagents with the card's `Delegation` model/effort, or `model: haiku, effort: low` if none is given. Review their output line by line.
6. Run the card's **Verify** commands until green. Paste their last lines into the PR body.
7. Self-review with a subagent: `Agent(model: <the other tier>, effort: high)` running the `docs/fleet/REVIEWER.md` rubric against `git diff origin/claude/vibrant-davinci-ck0mdw...HEAD` and the card. Fix every blocking finding.
8. Run `pnpm check:ownership --card <CARD-ID>` and `pnpm check:slop` (once those scripts exist; before P0.T1 merges, skip them and say so).
9. Push: `git push -u origin gl/<CARD-ID>` (retry on network errors at 2s, 4s, 8s and 16s).
10. Open a PR with the GitHub MCP tool `create_pull_request`: base `claude/vibrant-davinci-ck0mdw`, head `gl/<CARD-ID>`, title `<CARD-ID>: <card title>`. The body follows `.github/pull_request_template.md` (if that file is not there yet, use sections: Card, Acceptance criteria + test results, Verify output, Screenshots, Deviations, Session log).
11. Reply with exactly: `DONE <CARD-ID> <PR URL>` or `BLOCKED <CARD-ID> <PR URL> <one-line reason>`.

## Hard rules (summary of INSTRUCTIONS.md; that file wins on conflict)
- Never touch files outside `owns`. Never edit frozen contracts. File a CCR instead (INSTRUCTIONS §8).
- Never invent data, amounts, contract terms, quotes, IDs, API fields or test results. Unknown means stop and report.
- Stripe test mode only. No real emails. No secrets in code, logs, fixtures or PR text.
- No to-do markers, `console.log`, `any`, placeholder UI or skipped tests in your diff.
- Two failed attempts at the same problem means you stop and report BLOCKED with evidence.
- Do not merge. Do not start another card. Do not edit `docs/TASK_LOG.md` or `docs/ROADMAP.md`.
- Commit messages: `<type>(<CARD-ID>): <summary>`. Do not include model names in commits or PRs.
