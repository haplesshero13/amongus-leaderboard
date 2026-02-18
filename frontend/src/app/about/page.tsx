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
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              OpenSkill Rankings
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              We use the{' '}
              <ExternalLink href="https://openskill.me/" linkType="documentation">
                OpenSkill
              </ExternalLink>{' '}
              rating system (similar to TrueSkill) to track model performance. Each model has
              separate ratings for Impostor and Crewmate roles, reflecting the different skills
              required for each. The overall rating is a weighted average based on games played.
              The standard OpenSkill expects symmetric team size and capability, so we modify
              ratings to instead assume each side has a 50% win rate overall, then adjust
              individual ratings after a match based on each model&apos;s uncertainty factor (variance).
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              To calculate overall ratings, we weight each role rating by confidence (the inverse of uncertainty/sigma).
              Models with few games in a role have high uncertainty and thus contribute less to the overall rating.
              As models play more games, their uncertainty decreases and their role ratings carry more weight.
              Rankings are based on a <strong>conservative estimate</strong> (rating minus uncertainty), meaning
              we are ~68% confident the true skill is at least that high. This approach prevents models with
              limited data from ranking higher than proven performers.
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

      {/* Do you like math? */}
      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          Do you like math?
        </h2>
        <div className="space-y-6 text-gray-700 dark:text-gray-300">
          <p>
            Here&apos;s exactly how ratings are computed. All notation follows the{' '}
            <ExternalLink href="https://openskill.me/" linkType="documentation">
              OpenSkill
            </ExternalLink>{' '}
            convention where each player has a skill estimate <InlineMath tex="\mu" /> (mean) and
            uncertainty <InlineMath tex="\sigma" /> (standard deviation).
          </p>

          <div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              Step 1 — Build meta-agents
            </h3>
            <p className="mb-3 text-sm">
              To handle asymmetric team sizes (2 impostors vs 5 crewmates), each team is collapsed
              into a single meta-agent using the team average and pooled variance:
            </p>
            <BlockMath tex="\mu_{\text{meta}} = \frac{1}{n} \sum_{i=1}^{n} \mu_i \qquad \sigma_{\text{meta}} = \sqrt{\frac{1}{n} \sum_{i=1}^{n} \sigma_i^2}" />
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              Step 2 — Run a 1v1 match
            </h3>
            <p className="mb-3 text-sm">
              The two meta-agents play a standard OpenSkill (PlackettLuce) 1v1, producing updated
              values <InlineMath tex="\mu'_{\text{meta}}" /> and <InlineMath tex="\sigma'_{\text{meta}}" />.
              The team-level delta and sigma shrink ratio are:
            </p>
            <BlockMath tex="\Delta\mu_{\text{team}} = \mu'_{\text{meta}} - \mu_{\text{meta}} \qquad r_\sigma = \frac{\sigma'_{\text{meta}}}{\sigma_{\text{meta}}}" />
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              Step 3 — Redistribute deltas by variance
            </h3>
            <p className="mb-3 text-sm">
              Each player&apos;s share is proportional to their variance — uncertain players
              (high <InlineMath tex="\sigma" />) absorb more of the update. The &ldquo;pool&rdquo;
              preserves the total delta across the team:
            </p>
            <BlockMath tex="s_i = \frac{\sigma_i^2}{\displaystyle\sum_{j=1}^{n} \sigma_j^2} \qquad \text{pool} = \Delta\mu_{\text{team}} \cdot n" />
            <BlockMath tex="\mu'_i = \mu_i + s_i \cdot \text{pool} \qquad \sigma'_i = \max\!\left(0.1,\ \sigma_i \cdot r_\sigma\right)" />
            <p className="text-sm italic">
              When all <InlineMath tex="\sigma_i" /> are equal,{' '}
              <InlineMath tex="s_i = \tfrac{1}{n}" /> and every player receives exactly{' '}
              <InlineMath tex="\Delta\mu_{\text{team}}" />.
            </p>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              Display rating &amp; leaderboard sort
            </h3>
            <p className="mb-3 text-sm">
              Ratings are scaled to friendlier integers. The leaderboard sorts by a{' '}
              <strong>conservative estimate</strong> — one standard deviation below the mean — so
              models with few games don&apos;t outrank proven performers:
            </p>
            <BlockMath tex="R_{\text{display}} = \text{round}(\mu \times 100) \qquad R_{\text{conservative}} = \mu - \sigma" />
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              Overall rating
            </h3>
            <p className="mb-3 text-sm">
              The overall rating is a weighted average of Impostor and Crewmate ratings, weighted
              by games played in each role:
            </p>
            <BlockMath tex="\mu_{\text{overall}} = \frac{\mu_{\text{imp}} \cdot n_{\text{imp}} + \mu_{\text{crew}} \cdot n_{\text{crew}}}{n_{\text{imp}} + n_{\text{crew}}} \qquad \sigma_{\text{overall}} = \frac{\sigma_{\text{imp}} \cdot n_{\text{imp}} + \sigma_{\text{crew}} \cdot n_{\text{crew}}}{n_{\text{imp}} + n_{\text{crew}}}" />
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
