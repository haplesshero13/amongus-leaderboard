# Agent Instructions

## The rule

For all non-trivial changes, follow this one rule.

The generator is never the evaluator. Always two different agents, always different context windows.

## How to start

New goal → `@planner [your goal in natural language sentences]`
Continue existing work → read PLAN.md and REVIEW.md, then `@builder`

## Files that matter

| File         | Written by | Read by           |
| ------------ | ---------- | ----------------- |
| `PLAN.md`    | planner    | builder, reviewer |
| `HANDOFF.md` | builder    | reviewer          |
| `REVIEW.md`  | reviewer   | builder, human    |

## If you're unsure which agent to call

- No PLAN.md yet → planner
- PLAN.md exists, last REVIEW.md says APPROVED or doesn't exist → builder
- HANDOFF.md is newer than REVIEW.md → reviewer
- REVIEW.md says ESCALATE → ask the human

## What Not to Put Here

- Actual workflow documentation → use README
- Exhaustive commands → use README
- Any instruction that would benefit both humans and agents → use README
- Code style rules → use a linter
- Framework conventions → the codebase demonstrates them
- Specifics about files that could get out of date → just search the repo
