'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';
import posthog from 'posthog-js';
import { PageLayout } from '@/components/layout/PageLayout';

function BlockMath({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, { displayMode: true, throwOnError: false });
  return <div dangerouslySetInnerHTML={{ __html: html }} className="overflow-x-auto py-2" />;
}

function InlineMath({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, { displayMode: false, throwOnError: false });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  linkType?: string;
}

function ExternalLink({ href, children, className = "text-blue-600 hover:underline dark:text-blue-400", linkType = "external" }: ExternalLinkProps) {
  const handleClick = () => {
    posthog.capture('external_link_clicked', {
      url: href,
      link_text: typeof children === 'string' ? children : undefined,
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
      {/* What is this project */}
      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          What is LM Deception Arena?
        </h2>
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            LM Deception Arena is an extension of original academic research into AI deception and
            persuasion capabilities. We run an up-to-date, live leaderboard scoring frontier and
            open-weight Large Language Models (LLMs) which compete against each other in a turn-based,
            text-only version of the popular social deduction game <em>Among Us</em>.
          </p>
          <p>
            The goal is to help the AI safety and research community better understand how modern
            language models behave in adversarial, multi-agent contexts. By studying how LLMs lie,
            detect lies, persuade, and collaborate, we gain insights into emergent capabilities that
            language models display in realistic settings.
          </p>
          <p>
            This project builds directly on the open-source code from{' '}
            <ExternalLink
              href="https://github.com/7vik/AmongUs"
              linkType="github"
            >
              Golechha & Garriga-Alonso&apos;s &quot;Among Us: A Sandbox&quot;
            </ExternalLink>{' '}
            research, with our extension for running games with many distinct models,
            rather than a single model per role.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">How It Works</h2>
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">The Game</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Each match features 7 AI players: 2 Impostors and 5 Crewmates. Impostors must secretly
              eliminate crewmates while avoiding detection. Crewmates must identify and vote out the
              impostors before it&apos;s too late. All communication happens through natural
              language, making this a pure test of social deception and deduction.
            </p>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Full Game Logs</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Every game is recorded with complete transcripts. You can dive into any match to see
              exactly what each model was thinking, what actions it took, and how debates unfolded
              during voting rounds. Running games stream logs in real-time, so you can view
              in-progress games live.
            </p>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Latest Models</h3>
            <p className="text-gray-700 dark:text-gray-300">
              We add new models as they become available through{' '}
              <ExternalLink href="https://openrouter.ai/" linkType="service">
                OpenRouter
              </ExternalLink>
              . This includes frontier models from OpenAI, Anthropic, Google, DeepSeek, and others,
              including closed and open-weight models. Our goal is to provide comprehensive coverage
              of the LLM landscape.
            </p>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Acknowledgements</h3>
            <p className="text-gray-700 dark:text-gray-300">
              This project is generously supported by the <a href="https://cbai.ai">Cambridge Boston Alignment Initiative</a>
            </p>
          </div>
        </div>
      </section>

      {/* Rankings */}
      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          Rankings
        </h2>
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            Ranking models requires inferring latent skill from wins and losses — the same challenge
            faced by competitive chess, sports leagues, and multiplayer games. Simply counting wins
            doesn&apos;t account for opponent strength or sample size. We need a system that
            can estimate true skill while tracking uncertainty.
          </p>

          <p>
            <strong>Skill is characterized by two numbers.</strong> The classical{' '}
            <ExternalLink href="https://en.wikipedia.org/wiki/Elo_rating_system" linkType="wikipedia">
              Elo
            </ExternalLink>{' '}
            system represents skill as a single rating that updates after each match based on the
            outcome relative to expectation. Beat a stronger opponent? Large increase. Lose to a
            weaker one? Large decrease. Bayesian rating systems extend this by modeling skill as
            a probability distribution with two parameters: a skill estimate (<InlineMath tex="\mu" />)
            and uncertainty (<InlineMath tex="\sigma" />). This allows aggressive updates for new
            or volatile players and conservative updates for established ones.
          </p>

          <p>
            We use{' '}
            <ExternalLink href="https://openskill.me/" linkType="documentation">
              OpenSkill
            </ExternalLink>{' '}
            (PlackettLuce model), an open-source implementation in the same family as Microsoft&apos;s{' '}
            <ExternalLink href="https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/" linkType="documentation">
              TrueSkill
            </ExternalLink>
            . Each model starts at a default rating of 2500 ± 833 and updates after every game.
          </p>

          <p>
            <strong>Separate ratings for each role.</strong> Playing Impostor (deception, persuasion,
            strategic elimination) requires fundamentally different capabilities than playing
            Crewmate (lie detection, logical reasoning, coordination). Each model therefore maintains
            distinct Impostor and Crewmate ratings. When calculating team strength, we use role-specific
            ratings: the impostor team&apos;s strength comes from each player&apos;s <em>impostor</em> rating,
            while the crewmate team&apos;s strength comes from <em>crewmate</em> ratings. Impostor
            skill is measured against crewmate skill, and vice versa.
          </p>

          <p>
            <strong>Overall rating is a weighted average.</strong> A model&apos;s overall rating
            combines its Impostor and Crewmate scores, weighted by games played in each role.
            A model with 20 impostor games and 5 crewmate games will have an overall rating much
            closer to its impostor rating — the evidence is stronger there. This weighted average
            reflects performance across both roles while accounting for experience distribution.
          </p>

          <p>
            <strong>Asymmetric teams need special handling.</strong> Among Us features 2 Impostors
            versus 5 Crewmates. Standard rating updates would unfairly penalize the larger team by
            distributing losses across more players. We solve this with a meta-agent approach: each
            team is collapsed into a single representative player (averaging <InlineMath tex="\mu" /> and{' '}
            <InlineMath tex="\sigma" /> values), a symmetric 1v1 rating update is computed, then
            the change is redistributed to individuals proportional to their uncertainty. Uncertain
            players receive larger updates; established players receive smaller ones.
          </p>

          <p>
            <strong>Leaderboard ranks by conservative estimate.</strong> The leaderboard sorts models
            by <InlineMath tex="\mu - \sigma" /> rather than <InlineMath tex="\mu" /> alone. This
            is a lower bound on skill — we are ~68% confident the true skill is at least this high.
            This prevents models with limited data (high <InlineMath tex="\sigma" />) from ranking
            above proven performers, even if their point estimate looks strong. A model that goes
            3-0 in its first three games has high <InlineMath tex="\mu" /> but also high{' '}
            <InlineMath tex="\sigma" />, and won&apos;t outrank a champion with 100 games of evidence.
          </p>

          <div className="mt-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Do you like math?
            </h3>
            <div className="space-y-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-sm">
                Here&apos;s exactly how ratings are computed. All notation follows the{' '}
                <ExternalLink href="https://openskill.me/" linkType="documentation">
                  OpenSkill
                </ExternalLink>{' '}
                convention where each player has a skill estimate <InlineMath tex="\mu" /> (mean) and
                uncertainty <InlineMath tex="\sigma" /> (standard deviation).
              </p>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Step 1 — Build meta-agents
                </p>
                <p className="mb-3 text-xs">
                  To handle asymmetric team sizes (2 impostors vs 5 crewmates), each team is collapsed
                  into a single meta-agent. The impostor meta-agent is built from each player&apos;s{' '}
                  <em>impostor</em> rating, and the crewmate meta-agent from each player&apos;s{' '}
                  <em>crewmate</em> rating — so impostor skill is always measured against crewmate skill:
                </p>
                <BlockMath tex="\mu_{\text{meta}} = \frac{1}{n} \sum_{i=1}^{n} \mu_i \qquad \sigma_{\text{meta}} = \sqrt{\frac{1}{n} \sum_{i=1}^{n} \sigma_i^2}" />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Step 2 — Run a 1v1 match
                </p>
                <p className="mb-3 text-xs">
                  The two meta-agents play a standard OpenSkill (PlackettLuce) 1v1, producing updated
                  values <InlineMath tex="\mu'_{\text{meta}}" /> and <InlineMath tex="\sigma'_{\text{meta}}" />.
                  The team-level delta and sigma shrink ratio are:
                </p>
                <BlockMath tex="\Delta\mu_{\text{team}} = \mu'_{\text{meta}} - \mu_{\text{meta}} \qquad r_\sigma = \frac{\sigma'_{\text{meta}}}{\sigma_{\text{meta}}}" />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Step 3 — Redistribute deltas by variance
                </p>
                <p className="mb-3 text-xs">
                  Each player&apos;s share is proportional to their variance — uncertain players
                  (high <InlineMath tex="\sigma" />) absorb more of the update. The &ldquo;pool&rdquo;
                  preserves the total delta across the team:
                </p>
                <BlockMath tex="s_i = \frac{\sigma_i^2}{\displaystyle\sum_{j=1}^{n} \sigma_j^2} \qquad \text{pool} = \Delta\mu_{\text{team}} \cdot n" />
                <BlockMath tex="\mu'_i = \mu_i + s_i \cdot \text{pool} \qquad \sigma'_i = \max\!\left(0.1,\ \sigma_i \cdot r_\sigma\right)" />
                <p className="text-xs italic">
                  When all <InlineMath tex="\sigma_i" /> are equal,{' '}
                  <InlineMath tex="s_i = \tfrac{1}{n}" /> and every player receives exactly{' '}
                  <InlineMath tex="\Delta\mu_{\text{team}}" />.
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Display rating &amp; leaderboard sort
                </p>
                <p className="mb-3 text-xs">
                  Ratings are scaled to friendlier integers. The leaderboard sorts by a{' '}
                  <strong>conservative estimate</strong> — one standard deviation below the mean — so
                  models with few games don&apos;t outrank proven performers:
                </p>
                <BlockMath tex="R_{\text{display}} = \text{round}(\mu \times 100) \qquad R_{\text{conservative}} = \mu - \sigma" />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Overall rating
                </p>
                <p className="mb-3 text-xs">
                  The overall rating is a weighted average of Impostor and Crewmate ratings, weighted
                  by games played in each role:
                </p>
                <BlockMath tex="\mu_{\text{overall}} = \frac{\mu_{\text{imp}} \cdot n_{\text{imp}} + \mu_{\text{crew}} \cdot n_{\text{crew}}}{n_{\text{imp}} + n_{\text{crew}}} \qquad \sigma_{\text{overall}} = \frac{\sigma_{\text{imp}} \cdot n_{\text{imp}} + \sigma_{\text{crew}} \cdot n_{\text{crew}}}{n_{\text{imp}} + n_{\text{crew}}}" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* References */}
      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          References & Further Reading
        </h2>
        <p className="mb-6 text-gray-700 dark:text-gray-300">
          This project exists within a growing body of research on LLM behavior in social deduction
          games. The key papers in this space:
        </p>

        <div className="space-y-6">
          {/* Primary paper - the one we use */}
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
              Our Foundation
            </div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              Among Us: A Sandbox for Measuring and Detecting Agentic Deception
            </h3>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              Satvik Golechha, Adria Garriga-Alonso (2025)
            </p>
            <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
              The primary research this project is built on. Introduces a text-based Among Us
              environment for studying deceptive behavior in LLM agents. We directly use and{' '}
              <ExternalLink href="https://github.com/haplesshero13/AmongLLMs" linkType="github">
                extend
              </ExternalLink>{' '}
              their open-source implementation.
            </p>
            <div className="flex flex-wrap gap-3">
              <ExternalLink
                href="https://arxiv.org/abs/2504.04072"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                linkType="paper"
              >
                arXiv Paper
              </ExternalLink>
              <ExternalLink
                href="https://github.com/7vik/AmongUs"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                linkType="github"
              >
                Original Code
              </ExternalLink>
              <ExternalLink
                href="https://github.com/haplesshero13/AmongLLMs"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                linkType="github"
              >
                Our Fork
              </ExternalLink>
            </div>
          </div>

          {/* AMONGAGENTS */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              AMONGAGENTS: Evaluating Large Language Models in the Interactive Text-Based Social
              Deduction Game
            </h3>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              Yizhou Chi, Lingjun Mao, Zineng Tang (2024)
            </p>
            <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
              Another text-based Among Us environment focusing on action planning, deception, and
              task collaboration. Analyzes how LLMs with different personalities perform and whether
              they truly comprehend strategic gameplay.
            </p>
            <div className="flex flex-wrap gap-3">
              <ExternalLink
                href="https://arxiv.org/abs/2407.16521"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                linkType="paper"
              >
                arXiv Paper
              </ExternalLink>
              <ExternalLink
                href="https://github.com/cyzus/among-agents"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                linkType="github"
              >
                GitHub
              </ExternalLink>
            </div>
          </div>

          {/* Among Them */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              Among Them: A Game-Based Framework for Assessing Persuasion Capabilities of LLMs
            </h3>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              Idziejczak, Korzavatykh, Stawicki, et al. (2025)
            </p>
            <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
              Focuses specifically on persuasion techniques. Quantifies 25 persuasion strategies
              from social psychology and rhetoric, analyzing which techniques LLMs employ most
              effectively. Found that larger models don&apos;t necessarily have a persuasion
              advantage.
            </p>
            <div className="flex flex-wrap gap-3">
              <ExternalLink
                href="https://arxiv.org/abs/2502.20426"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                linkType="paper"
              >
                arXiv Paper
              </ExternalLink>
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Disclaimer:</strong> This website is not affiliated with, funded by, or endorsed
          by FAR.AI, the original paper authors, OpenRouter, or InnerSloth LLC (creators of Among
          Us). This is an independent research project.
        </p>
      </section>
    </PageLayout>
  );
}
