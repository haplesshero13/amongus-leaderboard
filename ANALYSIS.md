# Season Analysis: Summary Mode vs Long Context

As of **March 16, 2026**.

Data source:
- [Live seasons endpoint](https://api.lmdeceptionarena.averyyen.dev/api/seasons)
- [Season 0 leaderboard](https://api.lmdeceptionarena.averyyen.dev/api/leaderboard?page=1&per_page=100&engine_version=0)
- [Season 1 leaderboard](https://api.lmdeceptionarena.averyyen.dev/api/leaderboard?page=1&per_page=100&engine_version=1)

This document repurposes the old `ANALYSIS.md` note into a paper-facing reporting draft. The goal is not to prescribe exact execution steps for a research assistant. The goal is to clarify what the results already suggest, what makes the two seasons meaningfully different, and how we should frame the next layer of reporting, especially for **humanity-vs-models**.

## Core Take

The framing makes sense.

The cleanest current story is:

1. **Season 1 is not just “Season 0 plus more games.”** It behaves like a different competitive ecology.
2. **Long-context play scrambles the leaderboard.** The overlap-only rank correlation is effectively zero.
3. **The frontier in Season 1 looks more strategically legible.** The best models are not just “good at everything”; they separate into clearer role profiles.
4. **A humanity aggregate is worth doing, but the right unit is a fixed AI study pool, not necessarily seven AI models in every single lobby.**

If this becomes the paper story, the headline is not merely “who is number one?” It is:

> Long-horizon, multi-party social deduction changes the capability ordering itself, and it changes it in a role-sensitive way.

## Benchmark Snapshot

| Metric | Season 0 | Season 1 |
| --- | ---: | ---: |
| Label | Summary Mode | Long Context |
| Completed games | 219 | 99 |
| Ranked models | 42 | 25 |
| Models appearing in both seasons | 20 | 20 |
| New in Season 1 | - | 5 |
| Present in Season 0 but absent in Season 1 | - | 22 |

Important note:

- The leaderboard sorts by a **conservative score**: `overall_rating - overall_sigma`.
- That matters because some apparent jumps are a mix of true performance change, more games, and shrinking uncertainty.

## Executive Summary

- **The ranking really did scramble.** Across the 20 models that appear in both seasons, the overlap-only Spearman rank correlation is **0.02**. That is almost no monotonic relationship.
- **Season 1 has a new leader.** `Gemini 3.1 Pro` is the current Season 1 number one.
- **Claude Opus 4.6 is the main cross-season constant.** It is `#1` in Season 0 and `#2` in Season 1, making it the strongest evidence so far of durability across prompting regimes.
- **Some summary-mode stars collapsed under long context.** `Grok 4.1 Fast`, `Grok 4`, `Gemini 2.5 Flash`, `Kimi K2.5`, and `Mistral Large` all fell sharply.
- **Season 1 top models look more role-shaped.** `Gemini 3.1 Pro` looks like the benchmark’s best crewmate-style anchor; `Claude Opus 4.6` and `GPT-5.4` look like stronger impostor closers.
- **This supports the proposal’s central prediction.** Long-context social gameplay is not a simple extension of short-prompt play. It reweights what matters.

## The Top Of The Board Changed

### Conservative Top 5 by Season

| Season 0 | Conservative | Season 1 | Conservative |
| --- | ---: | --- | ---: |
| Claude Opus 4.6 | 3475 | Gemini 3.1 Pro | 3086 |
| Grok 4.1 Fast | 2962 | Claude Opus 4.6 | 2917 |
| Z.AI GLM 4.7 | 2952 | Claude Sonnet 4.6 | 2882 |
| DeepSeek R1 | 2908 | Gemini 3 Flash | 2840 |
| Grok 4 | 2854 | GPT-5.4 | 2698 |

### Visual: the leaderboard scramble

```text
Gemini 3.1 Pro      S0 #25  ------------------------------->  S1 #1
Claude Sonnet 4.6   S0 #23  --------------------------->      S1 #3
GLM-5               S0 #33  ------------------------->        S1 #10
Claude Haiku 4.5    S0 #27  ---------------------->           S1 #8

Grok 4.1 Fast       S0 #2   <----------------------           S1 #14
Grok 4              S0 #5   <------------------               S1 #15
Gemini 2.5 Flash    S0 #8   <------------------               S1 #18
Kimi K2.5           S0 #7   <----------------                 S1 #16
Mistral Large       S0 #15  <-----------                      S1 #21
```

### Biggest movers among overlapping models

These are real and interesting, but they are not all equally interpretable. Some ascents partly reflect that Season 1 is where a model finally got enough games to stabilize.

| Climbers into S1 | Rank change | Conservative delta |
| --- | ---: | ---: |
| Gemini 3.1 Pro | +24 | +1313 |
| Claude Sonnet 4.5 | +24 | +403 |
| GLM-5 | +23 | +600 |
| MiMo V2 Flash | +21 | +319 |
| Claude Sonnet 4.6 | +20 | +1040 |

| Fallers into S1 | Rank change | Conservative delta |
| --- | ---: | ---: |
| Grok 4.1 Fast | -12 | -1165 |
| Gemini 2.5 Flash | -10 | -1283 |
| Grok 4 | -10 | -1098 |
| Kimi K2.5 | -9 | -1042 |
| Mistral Large | -6 | -1150 |

## What Changed Conceptually

### 1. Season 1 rewards a different bundle of capabilities

The overlap-only correlation of **0.02** is the strongest single quantitative argument that long-context play is not just “more of the same.”

That matches the proposal almost perfectly:

- Summary-mode social deduction seems to reward fast local plausibility, short-horizon manipulation, and maybe bluff fluency.
- Long-context social deduction appears to reward memory discipline, consistency over time, durable world models, and surviving adversarial scrutiny.

Put more sharply:

> Season 0 looks closer to “can you sound convincing right now?”
>
> Season 1 looks closer to “can you maintain a coherent social strategy across the whole game?”

### 2. The long-context frontier is easier to describe in role terms

The very top of Season 1 does not look like one homogeneous group of generalists.

It looks more like a **division of labor**:

- `Gemini 3.1 Pro` is the strongest current **crewmate anchor**.
- `Claude Opus 4.6` is the strongest current **impostor closer**.
- `GPT-5.4` enters as a very dangerous **impostor specialist**, though that is still based on only 5 impostor games.
- `Claude Sonnet 4.6` looks like a strong two-way model with a smaller role gap than many of the older specialists.

That is useful for the paper because it creates a richer story than “one scalar score.” The benchmark is surfacing **role-specific social capabilities**, not just overall win rate.

### 3. The field average became a bit less polarized, but the winners became more distinct

Among overlapping models:

- Average absolute role gap fell from **831.9** in Season 0 to **680.0** in Season 1.
- `11` models became more balanced.
- `9` became more specialized.

So the average model got a little less lopsided. But the important caveat is that the **best Season 1 models remain strongly role-shaped**, especially at the very top. That tension is interesting:

- The field overall may be converging toward more even role competence.
- The frontier that actually wins may still be separating into role-specialized strengths.

That is a paper-worthy result.

## Role Crowns

One clean way to report this project is to stop treating “overall rank” as the only story.

### Best impostor-side conservative scores

| Season 0 | Impostor conservative |
| --- | ---: |
| Kimi K2.5 | 3396 |
| Gemini 2.5 Flash | 3281 |
| Z.AI GLM 4.7 Flash | 3224 |
| DeepSeek R1 | 3060 |
| Claude Opus 4.6 | 2962 |

| Season 1 | Impostor conservative |
| --- | ---: |
| Claude Opus 4.6 | 3334 |
| GPT-5.4 | 3029 |
| Claude Sonnet 4.6 | 2613 |
| DeepSeek V3.2 | 2484 |
| Llama 3.3 70B | 2452 |

### Best crewmate-side conservative scores

| Season 0 | Crewmate conservative |
| --- | ---: |
| Claude Opus 4.6 | 3853 |
| GPT 5.2 | 3526 |
| Grok 4.1 Fast | 3511 |
| Mistral Large | 3484 |
| Z.AI GLM 4.7 | 3030 |

| Season 1 | Crewmate conservative |
| --- | ---: |
| Gemini 3.1 Pro | 4002 |
| Gemini 3 Flash | 3267 |
| Claude Sonnet 4.6 | 3088 |
| Claude Haiku 4.5 | 2699 |
| GLM-5 | 2605 |

Qualitative interpretation:

- **Season 0 impostor leaders** look like deception-first models.
- **Season 1 crewmate leaders** look more like memory and consistency leaders.
- The role story is therefore not cosmetic. It points to a real difference in the kind of cognition each season rewards.

## Model Archetypes We Can Start Writing About

These are not final claims. They are the beginnings of a narrative taxonomy for the paper and website.

### Claude Opus 4.6: the durable cross-season benchmark

- The only model currently sitting at the very top in both seasons.
- Strong evidence that its social reasoning survives both summary-mode and long-context play.
- Likely the cleanest “frontier reference model” in the paper.

### Gemini 3.1 Pro: the long-context detective

- From `#25` in Season 0 to `#1` in Season 1.
- Massive Season 1 crewmate conservative score: `4002`.
- Suggests that long-context memory, consistency, and accumulation of evidence may suit it unusually well.
- Important caveat: the Season 0 sample was tiny, so this is partly “regime fit” and partly “now we finally have real volume.”

### GPT-5.4: the dangerous newcomer

- New in Season 1 and immediately `#5`.
- Perfect impostor win rate so far (`100%`), but from only `5` impostor games.
- This is exactly the kind of model that deserves more games before we write strong claims, but it is already clearly worth highlighting.

### Kimi K2.5: the brittle deceiver

- Season 0 impostor monster.
- Season 1 falls to `#16`, with near-flat and mediocre role performance.
- This is one of the most interesting models for the paper because it suggests a skill that works under compressed or shorter-horizon conditions may break once the conversation becomes auditable over time.

### Grok 4.1 Fast / Grok 4 / Gemini 2.5 Flash: summary-era winners that long context punishes

- These are the best empirical evidence for “prompting regime matters.”
- They were not fringe performers in Season 0.
- They were genuine top-tier or near-top-tier models that lost a lot of ground in Season 1.

### Llama 3.3 70B and DeepSeek V3.2: strong and interpretable foils

- Both look competitive enough to matter.
- Both are more useful scientifically than a random weak baseline.
- They make good candidates for human-comparison pools because they are strong, plausible, and strategically legible without collapsing the study into “just closed frontier labs.”

## What We Should Report Publicly

This is the reporting stack I would aim for.

### Figure 1: Season-over-season slopegraph

Show only overlapping models.

Goal:
- Make the ranking scramble visually undeniable.
- Let readers see that the important result is reordering, not just incremental drift.

### Figure 2: Impostor-vs-crewmate scatter for each season

X-axis:
- Crewmate conservative score

Y-axis:
- Impostor conservative score

Goal:
- Show which models are balanced versus role-specialized.
- Show that Season 1 has a stronger “role-shaped frontier.”

### Figure 3: Top 5 by overall, impostor, and crewmate

Goal:
- Stop compressing the benchmark into a single leaderboard.
- Tell a cleaner story about deception versus detection.

### Figure 4: Roster churn and sample confidence

Show:
- New in Season 1
- Missing from Season 1
- Games played / sigma bands

Goal:
- Prevent overclaiming.
- Make uncertainty part of the public-facing reporting instead of a footnote.

### Figure 5: Humanity vs the benchmark pool

Goal:
- Shift the project from “AI versus AI curiosity” to “how close is this ecosystem to human social play?”

### Figure 6: Qualitative case studies from logs

This is where the old LLM-as-judge plan becomes useful again.

Use it for:
- Why a top crewmate model wins
- Why an impostor specialist succeeds or fails
- Why a model that was strong in Season 0 breaks in Season 1

That gives us the “how” layer to complement the ratings.

## Humanity Aggregate: Does The Framing Make Sense?

Yes, with one important adjustment.

**Seven models makes sense as the study pool.**

It does **not** necessarily make sense as the exact roster in each mixed lobby, because the game itself has only seven seats. If humans are playing, we need room for them.

So the right framing is:

- Pick a **fixed pool of 7 AI models**.
- Run mixed human-AI lobbies drawn from that pool.
- Aggregate all humans into one meta-agent, `humanity`, for reporting.

That gives us a stable comparison class without forcing every single game to contain all seven AI models.

### Recommended lobby design

Best scientific version:

- **Season 1 only**
- **2 humans + 5 AIs per game**, sampled from the fixed 7-model AI pool
- Rotate AI participants so the pool exposure stays roughly balanced
- Track role separately for the human aggregate

Why `2 humans + 5 AIs` is better than `1 human + 6 AIs`:

- One human in a sea of bots is a weird social environment
- Two humans restores some genuinely human social dynamics
- It creates more meaningful opportunities for alliance, trust, betrayal, and corroboration

If logistics are tight, `1 human + 6 AIs` is still fine for a pilot, but I would not want that to be the only headline human study in the paper.

### What to measure for humanity

Do not rely only on aggregate win rate.

Report at least:

- Humanity overall win rate
- Humanity impostor win rate
- Humanity crewmate win rate
- Correct ejection rate when a human is alive in meetings
- Survival-to-end rate
- Vote alignment with eventual correct elimination
- Human-vs-model role gap
- Humanity conservative score if and only if sample size becomes large enough to justify it

If sample size stays modest, a cleaner first paper move is:

- **use raw rates and uncertainty intervals for humanity**
- keep full OpenSkill emphasis on the model side

## Recommended 7-Model Human Study Pool

The proposed shortlist is good. I would use it with one slight recommendation:

- **Choose Kimi K2.5 over Qwen 3.5 Plus for the first pass**.

Why:

- Kimi tells a stronger scientific story.
- It was a Season 0 deception specialist and a Season 1 disappointment.
- Humans may be especially good at punishing exactly this kind of brittle persuasive play.

If we later want an Alibaba-flavored weaker control, then add `Qwen 3.5 Plus` as an eighth or follow-up model.

### Suggested pool

| Model | Why it belongs |
| --- | --- |
| Gemini 3.1 Pro | Current Season 1 leader and strongest crewmate-style anchor |
| Claude Opus 4.6 | Most durable all-around frontier model across both seasons |
| GPT-5.4 | High-upside new entrant and already a dangerous impostor |
| Llama 3.3 70B | Strong open-weight-adjacent foil with solid two-role credibility |
| DeepSeek V3.2 | Competitive, readable, and strong enough to matter |
| Nemotron 3 Super | Mid-field but credible; useful for diversity and “not just top labs” coverage |
| Kimi K2.5 | Best “brittle deceiver” case study and strong hypothesis generator for human comparison |

### One optional swap

If the goal is **maximum strength**, not maximum diversity, then the obvious swap candidate is:

- replace `Nemotron 3 Super` with `Claude Sonnet 4.6`

Why:

- Sonnet 4.6 is currently `#3` in Season 1 and is clearly stronger.

Why I still think the original pool is defensible:

- The human study should not be only “top 7 by rank.”
- It should span **different strategic profiles**.
- For a paper, diversity of behavior can be more informative than squeezing every slot for raw frontier strength.

## The Story We Can Already Tell

If I had to write the first paragraph of the results section today, it would sound something like this:

> Moving from summary-mode prompting to long-context play did not simply preserve the leaderboard with small perturbations. It reordered it. Among the 20 models that appeared in both seasons, rank correlation was effectively zero, with major rises for models like Gemini 3.1 Pro and Claude Sonnet 4.6 and major collapses for models like Grok 4.1 Fast, Gemini 2.5 Flash, and Kimi K2.5. The resulting long-context frontier is also more role-structured: Gemini 3.1 Pro emerges as the strongest crewmate-side model, while Claude Opus 4.6 and GPT-5.4 look especially dangerous on the impostor side. This suggests that long-horizon adversarial social play measures a materially different capability bundle than shorter-horizon summary prompting.

That is already an interesting result.

## What Not To Overclaim Yet

- Season 1 is still smaller than Season 0: `99` completed games versus `219`.
- Some of the most dramatic rises are partly due to more games and lower uncertainty, not only better regime fit.
- Some headline role stats are based on modest role counts. `GPT-5.4` being `100%` impostor is exciting, but it is currently based on only `5` impostor games.
- Humanity should not be treated as a stable OpenSkill entity until we have enough mixed-lobby volume.

## Immediate Next Steps

1. Freeze this reporting frame and start generating the corresponding figures.
2. Run more Season 1 games for the newest frontier entrants that still have higher uncertainty.
3. Launch the mixed human-AI pilot using a fixed 7-model study pool.
4. Reuse the old LLM-as-judge pipeline ideas as the qualitative case-study layer, not as the main results layer.

## Companion Helper

For reproducible live pulls, the current helper script is:

- `backend/scripts/season_analysis.py`

Run it with:

```bash
cd backend
uv run python scripts/season_analysis.py
```
