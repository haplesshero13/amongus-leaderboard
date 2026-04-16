# Learnings

Keep only lessons that change how the next update is planned, built,
reviewed, or validated. Rewrite, merge, and prune continously.

Source control will track versions of this document, so keep it fresh.

## Current learnings

### Run ALL CI checks locally before pushing

- CI rejected the PR for two unused imports that `ruff check .` catches instantly.
- The reviewer only ran `ruff check` on the changed files, not the full suite.
- **Next time**: run the full CI equivalent (`ruff check .`, `pytest`, `bun run type-check`, `bun run lint`) before creating a PR, not just the files you touched.
- Applies to: head instance (before PR), builder (before handoff), reviewer (during verification).

### Replay `turn_log` can include system rows, not just player turns

- Completed-game summaries may append bookkeeping entries like `phase: "voting_results"`, `player: "None"`, `action: "VOTE_SUMMARY"` to `turn_log`.
- If the frontend renders every `turn_log` row as a player action, those system rows show up as fake gray "Human / Unknown / Player ?" bubbles.
- **Next time**: treat `turn_log` as mixed player-and-system data; only build chat bubbles for entries with a real `Player N` actor, and cover that with a regression test.
- Applies to: planning replay UI changes, building timeline parsers, reviewing completed-game log handling.
- Evidence: completed game `2bcda042-99e2-4bbc-879f-3de3343ba717` reproduced the bug with `VOTE_SUMMARY` rows.
