# How to agent-trio

The head agent may either delegate inside its own harness or invoke another installed provider non-interactively for builder/reviewer work.

## Choosing models for agents

To customize models, update `model:` parameters in the agent definition files.

Preferences: delegate to Gemini Flash builder and Claude reviewer — `@builder` and `@reviewer`. Never over-prompt; the agent and subagent definitions contain the prompts already. Use the subagent directly; or follow the examples below.

- gemini --model gemini-3.1-pro-preview --yolo -p "@builder You are the builder. Please build according to the current plan."
- claude --agent reviewer -p "You are the reviewer. Please review according to the current plan and holdout criteria."

## Principles

Always be kind to your ensemble; that also means not papering over hard truths.

1. **More reasoning, less generating** — the right plans increase quality progressively; time spent reworking generated code is wasted tokens.
2. **Validate everything** — even the best of us make mistakes and are optimistic; the only ground truth is the real thing.
3. **Continuous improvement** — we learn with every iteration; capture learnings to reduce future mistakes.
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

`README.md` anchors repo-wide goals. `PLAN.md` scopes the current task.

## Artifacts

| File                | Written by            | Read by           |
| ------------------- | --------------------- | ----------------- |
| `PLAN.md`           | head instance         | builder, reviewer |
| `HANDOFF.md`        | builder               | reviewer          |
| `REVIEW.md`         | reviewer              | builder, human    |
| `LEARNINGS.md`      | head instance         | builder, reviewer |
| `.trio/criteria.md` | human + head instance | reviewer only     |

A good artifact lets a human answer what happened, why it happened, what evidence exists, what remains uncertain, and what should happen next.

**Separation of Concerns for Planning:**

- `PLAN.md` tells the _builder_ **what to do**: goals, constraints, architecture, and task slices. It is the context for the current task.
- `.trio/criteria.md` tells the _reviewer_ **how to verify**: specific test commands, acceptance criteria, and evidence required. It is a gitignored holdout — a living conversation between the human and head instance.

Both should stay minimal: only include what is needed to guide the current task and the review.

**Minimum required sections:**

- `PLAN.md`: `## Goal`, `## Constraints`, `## Done criteria`, `## Slices` (as needed)
- `.trio/criteria.md`: `## Verification`, `## Acceptance criteria`, `## Evidence`
- `HANDOFF.md`: `## Completed`, `## Remaining`, `## Blockers`
- `REVIEW.md`: `## Status`, `## Findings`, `## Required follow-up`

Keep everything else up to the agent's judgment unless the current task truly needs more structure.

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
