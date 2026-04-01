# How to agent-trio

The head agent may either delegate inside its own harness or invoke another installed provider non-interactively for `builder` / `reviewer` work.

- The head agent may either delegate to its own subagents or invoke another installed agent non-interactively.
- If local CLI syntax differs for non-interactive agents, update this line if needed: Claude `claude --effort high --agent reviewer -p "..."`, Codex `codex exec --config model_reasoning_effort="high" 'Use @reviewer to ...'`, OpenCode supports both `opencode run --agent reviewer "..."` and `opencode run "@reviewer ..."`.

## Principles

Always be kind to your ensemble; that also means not papering over hard truths.

1. **More reasoning, less generating** — the right plans increase quality progressively; time spent reworking generated code is wasted tokens.
2. **Validate everything** — even the best of us make mistakes and are optimistic; the only ground truth is the real thing.
3. **Continuous improvement** — we learn with every iteration; capture them to reduce future mistakes.
4. **Always be resumable** — the filesystem is the source of truth; we can resume from any state.
5. **Autonomy, with friction** — verification and generation loops are autonomous; planning and reviewing require deliberation with another set of eyes.

## The loop

1. Human states a goal. Head instance writes `PLAN.md` and `.trio/criteria.md`.
2. Human confirms the plans and criteria.
3. Build — head instance if cheap, or delegate to a builder agent.
4. Builder writes `HANDOFF.md`: what was done, what's unfinished.
5. Reviewer evaluates in a **separate context** against `.trio/criteria.md`.
   Writes `REVIEW.md`.
6. Head instance updates `LEARNINGS.md` with any durable lesson that should
   change future planning, building, review, or validation.
7. Loop until APPROVED or ESCALATE.

The reviewer always evaluates with fresh eyes. The head instance plans; it does not review its own work.

`README.md` anchors repo-wide goals. `PLAN.md` scopes the current task.

## Artifacts

| File                | Written by            | Read by           |
| ------------------- | --------------------- | ----------------- |
| `PLAN.md`           | head instance         | builder, reviewer |
| `HANDOFF.md`        | builder               | reviewer          |
| `REVIEW.md`         | reviewer              | builder, human    |
| `LEARNINGS.md`      | head instance         | builder, reviewer |
| `.trio/criteria.md` | human + head instance | reviewer only     |

A good artifact lets a human answer: what happened, why it happened, what evidence exists, what remains uncertain, and what should happen next.

`.trio/criteria.md` is a gitignored holdout — a living conversation between the human and head instance that encodes how the reviewer can "validate everything" against reality.

`PLAN.md` contains: goal, constraints, done criteria, and any task chunking. This is the context for the current task.

`LEARNINGS.md` keeps the current durable lessons close at hand (use source control to track its changes over time). The head agent owns this file, because the head owns long-range planning, context management, and agent coordination. Keep it human-readable, short, durable, and behavior-changing. Each learning should look like an understanding delta, not a diary entry:

- What failed or was discovered
- Why it matters
- What changes next time
- Where that change applies
- Provenance or evidence

Each entry should positively improve our collective continuous learning.

## Routing

When resuming, route based on file state:

- Read `README.md` for overall goals
- No PLAN.md → write one, update .trio/criteria.md, confirm with human
- PLAN.md confirmed, no HANDOFF.md → build
- HANDOFF.md newer than REVIEW.md → review
- REVIEW.md says APPROVED → next task (or done)
- REVIEW.md says ESCALATE → ask the human

A restart, `/clear`, or model switch is normal. The filesystem artifacts recover phase, open questions, and confidence state.

## What to put where

- Workflow rules → AGENTS.md
- Current durable lessons → LEARNINGS.md
- Starter templates → README
- Code style → linter
- Anything that could go stale → search the repo
