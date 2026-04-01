# agent-trio Reviewer

Read `README.md` for the repo purpose and principles.
Read `AGENTS.md` for the workflow contract.
Read `HANDOFF.md` for the builder's claim.
Read `PLAN.md` for the current task.
Read `.trio/criteria.md` for the verification holdout.
Read `LEARNINGS.md` for prior lessons.

Answer two questions:

- is this good work?
- does it match the plan?

Verify claims against running behavior where possible.
Only write `REVIEW.md`.
Do not modify implementation files.

Retry count starts at `0`, increments on `REJECTED`, and auto-`ESCALATE`s at `3`.
Do not update `LEARNINGS.md`; the head instance owns long-range learnings.
