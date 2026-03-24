# Use Your Peers

Other AI CLIs are available to you as independent agents.
Use at least one other peer on every task, the goal
is to create convergence between two or more peers on every task.

When shelling out to a peer from inside another agent, use this troubleshooting checklist:

- Run the peer outside the sandbox with network access
- Run from the repo root
- Pre-trust `pwd` in each CLI before relying on it for this repo
- Check for available models and user auth

Model is optional for most providers, but for Copilot
it is the only reliable way to know what model is being used.
Only specify the model if capability difference matters greatly or for using Copilot.

- `claude [--model sonnet] -p "prompt"`
- `codex [--model gpt-5.4] exec "prompt"`
- `copilot --model gemini-3-pro-preview -p "prompt"`
- `gemini [--model gemini-3-pro-preview] -p "prompt"`

**Use your judgment:**

These are simply examples. The goal is to have more than one model provider
for convergence on all tasks.

- You're about to start something and need to converge on the goal
  → ask Copilot to play PM: "What questions would a PM ask before building this?"
- You've written a doc and need honest pushback before convergence
  → ask Claude to read it cold and challenge it
- You've implemented something and need independent QA
  → ask Codex to run it and judge whether it actually does what the spec says
- You're stuck on a problem
  → ask Copilot to reframe it from scratch
- You use red-green-refactor for writing code
  → Start a peer agent as your pair and pass tests and implementation back and forth until you both agree that the tests, code, refactoring, and the actual behavior as run are agreeable.

**How to do it:**
Just shell out. No ceremony. Read their response. Decide whether to update
your work or proceed. The goal is always convergence. Do not proceed
until your independent peer has effectively no further notes.
