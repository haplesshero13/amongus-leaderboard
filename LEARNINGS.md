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
