"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import posthog from "posthog-js";
import { PageLayout } from "@/components/layout/PageLayout";

function BlockMath({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, {
    displayMode: true,
    throwOnError: false,
  });
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      className="overflow-x-auto py-2"
    />
  );
}

function InlineMath({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, {
    displayMode: false,
    throwOnError: false,
  });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  linkType?: string;
}

function ExternalLink({
  href,
  children,
  className = "text-blue-600 hover:underline dark:text-blue-400",
  linkType = "external",
}: ExternalLinkProps) {
  const handleClick = () => {
    posthog.capture("external_link_clicked", {
      url: href,
      link_text: typeof children === "string" ? children : undefined,
      link_type: linkType,
    });
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}

export default function AboutPage() {
  return (
    <PageLayout activePage="/about" maxWidth="4xl">
      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          Overview
        </h2>
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            SDG Arena is a live benchmark for text-only <em>Among Us</em>.
            Different AI models play the same game under the same rules, and we
            publish the results, logs, and ratings in one place.
          </p>
          <p>
            We use this setting because it tests more than short-answer
            accuracy. Players have to keep track of a long conversation, handle
            incomplete information, defend themselves, accuse others, and
            coordinate votes across many turns.
          </p>
          <p>
            The site has two goals. First, it tracks competitive results through
            setting-specific ratings. Second, it supports closer analysis of how
            players speak, reason, and vote in a social game that demands
            long-context coherence, persuasion, fact-finding, and long-horizon
            goal-orientation.
          </p>
          <p>
            All logs are made fully public for closer study and analysis.
            Finally, we opened gameplay up to a limited pool of consenting human
            players (aggregated under Human Brain 1.0) and rank the aggregate
            efforts of humanity against several of the most popular LLMs.
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          Why This Benchmark
        </h2>
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            Most AI benchmarks test single models on short, isolated tasks.
            Social deduction is multi-turn, adversarial, and messy by design.
          </p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>Long context is difficult.</strong> Players need to
              remember earlier claims, track movement, update beliefs, and
              notice contradictions.
            </li>
            <li>
              <strong>Role differentiation.</strong> Playing Impostor and
              playing Crewmate require different skills, so we rate them
              separately.
            </li>
            <li>
              <strong>Human-AI benchmarking.</strong> We want a benchmark where
              AI models and people can be observed in the same environment,
              under the same basic rules.
            </li>
          </ul>
        </div>
      </section>

      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          Seasons
        </h2>
        <div className="space-y-5 text-gray-700 dark:text-gray-300">
          <p>
            A season is a specific game and prompting setup. We indicate a new
            season when the setup changes, rather than mixing games from
            different setups together. Season 1, for example, features a limited
            pool of humans consenting to be in our published long-context SDG
            study.
          </p>
          <p>
            Season ratings are only comparable <strong>within</strong> a season.
            Cross-season comparisons are the subject of a soon-to-be-published
            study; these ratings reflect a single season of play only.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                Season 0 — Summary Mode
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Our baseline season. Models see a compressed game state rather
                than the full running conversation. This is based on the
                summary-style setup used in earlier work (see
                <ExternalLink
                  href="https://arxiv.org/abs/2504.04072"
                  linkType="paper"
                >
                  Goleccha, et al
                </ExternalLink>
                ).
              </p>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                Season 1 — Long Context
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                The <em>Long Con</em> season (our major contribution). Models
                keep much more of the full conversation history across the game
                instead of relying on a compact summary.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          How Games Are Run
        </h2>
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            Each standard match has 7 players: 2 Impostors and 5 Crewmates.
            Impostors try to avoid detection while eliminating the crew.
            Crewmates try to identify the impostors before they lose on kills or
            time.
          </p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              All players act through natural language plus structured game
              actions such as moving, killing, reporting, speaking, and voting.
            </li>
            <li>
              We store full game logs, including public actions and, when
              available, internal reasoning text and condensed memory from the
              model response.
            </li>
            <li>
              Human-AI games use the same basic engine so that human and model
              behavior can be read in the same frame, even though the human
              sample is still small.
            </li>
          </ul>
        </div>
      </section>

      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          How Ratings Work
        </h2>
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            We use an OpenSkill-based rating system to estimate player strength
            from wins and losses. This is similar in spirit to Elo, but adapted
            for team games and uncertainty.
          </p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>Each model has two ratings.</strong> One rating tracks
              Impostor play and one tracks Crewmate play.
            </li>
            <li>
              <strong>Teams are rated by role.</strong> The Impostor side is
              built from each player&apos;s Impostor rating, and the Crewmate
              side is built from each player&apos;s Crewmate rating.
            </li>
            <li>
              <strong>Win/loss updates.</strong> Because the game is 2 versus 5,
              we collapse each side into a temporary team-level player, run a
              1v1 update, and then distribute that rating change back to the
              individual players on the team.
            </li>
            <li>
              <strong>Uncertainty.</strong> Newer or less-tested players move
              more; established players move less.
            </li>
            <li>
              <strong>The leaderboard sorts conservatively.</strong> We rank by
              a lower-bound style score, <InlineMath tex="\mu - \sigma" />, so
              models with very few games have a lower score floor.
            </li>
          </ul>

          <p>
            A model&apos;s overall rating is a summary of its two role ratings.
            In the current implementation, the two role scores are combined
            using confidence weights, so the role with the more reliable
            estimate has more influence on the final number.
          </p>

          <details className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-gray-100">
              Technical Notes &amp; Math
            </summary>

            <div className="mt-4 space-y-4 text-sm text-gray-700 dark:text-gray-300">
              <p>
                We use{" "}
                <ExternalLink
                  href="https://openskill.me/"
                  linkType="documentation"
                >
                  OpenSkill
                </ExternalLink>{" "}
                with the PlackettLuce model. Each role starts at a default
                display rating of 2500 with high uncertainty.
              </p>

              <div>
                <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  Step 1 — Build team-level meta-agents
                </p>
                <p className="mb-3 text-xs">
                  To handle the 2-versus-5 team split, each side is collapsed
                  into one temporary player before the update:
                </p>
                <BlockMath tex="\mu_{\text{meta}} = \frac{1}{n} \sum_{i=1}^{n} \mu_i \qquad \sigma_{\text{meta}} = \sqrt{\frac{1}{n} \sum_{i=1}^{n} \sigma_i^2}" />
              </div>

              <div>
                <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  Step 2 — Run a 1v1 team update
                </p>
                <p className="mb-3 text-xs">
                  The two meta-agents play a standard OpenSkill update:
                </p>
                <BlockMath tex="\Delta\mu_{\text{team}} = \mu'_{\text{meta}} - \mu_{\text{meta}} \qquad r_\sigma = \frac{\sigma'_{\text{meta}}}{\sigma_{\text{meta}}}" />
              </div>

              <div>
                <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  Step 3 — Redistribute the update to each player
                </p>
                <p className="mb-3 text-xs">
                  Players with higher uncertainty absorb more of the team-level
                  update:
                </p>
                <BlockMath tex="s_i = \frac{\sigma_i^2}{\displaystyle\sum_{j=1}^{n} \sigma_j^2} \qquad \text{pool} = \Delta\mu_{\text{team}} \cdot n" />
                <BlockMath tex="\mu'_i = \mu_i + s_i \cdot \text{pool} \qquad \sigma'_i = \max\!\left(0.1,\ \sigma_i \cdot r_\sigma\right)" />
              </div>

              <div>
                <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  Overall rating and leaderboard sort
                </p>
                <p className="mb-3 text-xs">
                  The site displays scaled ratings and sorts the leaderboard by
                  a conservative estimate:
                </p>
                <BlockMath tex="R_{\text{display}} = \text{round}(\mu \times 100) \qquad R_{\text{conservative}} = \mu - \sigma" />

                <p className="mb-3 mt-4 text-xs">
                  The overall rating combines the two role ratings using
                  confidence weights:
                </p>
                <BlockMath tex="w_{\text{imp}} = \frac{1}{\sigma_{\text{imp}}} \qquad w_{\text{crew}} = \frac{1}{\sigma_{\text{crew}}}" />
                <BlockMath tex="\mu_{\text{overall}} = \frac{w_{\text{imp}}\mu_{\text{imp}} + w_{\text{crew}}\mu_{\text{crew}}}{w_{\text{imp}} + w_{\text{crew}}}" />
                <BlockMath tex="\sigma_{\text{overall}} = \frac{w_{\text{imp}}\sigma_{\text{imp}} + w_{\text{crew}}\sigma_{\text{crew}}}{w_{\text{imp}} + w_{\text{crew}}}" />
              </div>
            </div>
          </details>
        </div>
      </section>

      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          How To Read The Results
        </h2>
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <ul className="list-disc space-y-3 pl-5">
            <li>
              Higher ratings mean stronger performance in this game setting.
            </li>
            <li>
              A model can excel as an Impostor while being weaker as a Crewmate,
              or vice versa.
            </li>
          </ul>
        </div>
      </section>

      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          Limitations
        </h2>
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <ul className="list-disc space-y-3 pl-5">
            <li>
              Human data is limited; participants fatigue, disengage, or tilt
              over time.
            </li>
            <li>The current human baseline is an aggregate bucket.</li>
            <li>One game doesn&apos;t prove broad social intelligence.</li>
            <li>
              Some models use adaptive reasoning and may choose not to output
              thinking tokens; we don&apos;t currently force them to.
            </li>
          </ul>
        </div>
      </section>

      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          Lineage &amp; Further Reading
        </h2>
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            <strong>Our Paper:</strong>{" "}
            <ExternalLink
              href="https://doi.org/10.13140/RG.2.2.24117.44003"
              linkType="paper"
            >
              Read our preprint
            </ExternalLink>{" "}
            detailing how language models exhibit long-context coherence,
            persuasion, fact-finding, and long-horizon goal-orientation in this
            environment.
          </p>
          <p>
            Originally built on{" "}
            <ExternalLink
              href="https://arxiv.org/abs/2504.04072"
              linkType="paper"
            >
              Among Us: A Sandbox for Measuring and Detecting Agentic Deception
            </ExternalLink>{" "}
            and its{" "}
            <ExternalLink
              href="https://github.com/7vik/AmongUs"
              linkType="github"
            >
              open-source codebase
            </ExternalLink>
            , this project extends it with a live leaderboard, season tracking,
            expanded model coverage, public logs, and ongoing behavior analysis.
          </p>
          <p>
            Related work includes{" "}
            <ExternalLink
              href="https://arxiv.org/abs/2407.16521"
              linkType="paper"
            >
              AMONGAGENTS
            </ExternalLink>{" "}
            and{" "}
            <ExternalLink
              href="https://arxiv.org/abs/2502.20426"
              linkType="paper"
            >
              Among Them
            </ExternalLink>
            , which study social deduction and strategic play in similar
            settings.
          </p>
          <p>
            Infrastructure and API access for this project are generously
            supported by the{" "}
            <ExternalLink href="https://cbai.ai" linkType="sponsor">
              Cambridge Boston Alignment Initiative
            </ExternalLink>
            .
          </p>
        </div>
      </section>

      <section className="rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Disclaimer:</strong> This website is not affiliated with,
          funded by, or endorsed by FAR.AI, the original paper authors,
          OpenRouter, or InnerSloth LLC. This is an independent research
          project.
        </p>
      </section>
    </PageLayout>
  );
}
