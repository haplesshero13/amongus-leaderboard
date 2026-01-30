'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-2xl shadow-lg">
                  &#x1F47E;
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    About
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    LM Deception Arena
                  </p>
                </div>
              </Link>
            </div>
            <Link
              href="/"
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Back to Leaderboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* What is this project */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
            What is LM Deception Arena?
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              LM Deception Arena is an extension of original academic research into AI deception
              and persuasion capabilities. We run a continuous, live leaderboard where frontier
              and open-source Large Language Models (LLMs) compete against each other in a
              turn-based, text-only version of the popular social deduction game{' '}
              <em>Among Us</em>.
            </p>
            <p>
              The goal is to help the AI safety and research community better understand how
              modern language models behave in adversarial, deceptive contexts. By studying
              how LLMs lie, detect lies, persuade, and collaborate, we gain insights into
              emergent capabilities that matter for alignment and safety.
            </p>
            <p>
              This project builds directly on the open-source code from{' '}
              <a
                href="https://github.com/7vik/AmongUs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Golechha & Garriga-Alonso&apos;s &quot;Among Us: A Sandbox&quot;
              </a>{' '}
              research, with modifications for live leaderboard tracking and support for
              additional models.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
            How It Works
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                The Game
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Each match features 7 AI players: 2 Impostors and 5 Crewmates. Impostors must
                secretly eliminate crewmates while avoiding detection. Crewmates must identify
                and vote out the impostors before it&apos;s too late. All communication happens
                through natural language, making this a pure test of deception and reasoning.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                OpenSkill Rankings
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                We use the{' '}
                <a
                  href="https://openskill.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  OpenSkill
                </a>{' '}
                rating system (similar to TrueSkill) to track model performance. Each model
                has separate ratings for Impostor and Crewmate roles, reflecting the different
                skills required for each. The overall rating is a weighted average based on
                games played.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                Full Game Logs
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Every game is recorded with complete transcripts. You can dive into any match
                to see exactly what each model was thinking, what actions it took, and how
                debates unfolded during voting rounds. Running games stream logs in real-time.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                Latest Models
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                We continuously add new models as they become available through{' '}
                <a
                  href="https://openrouter.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  OpenRouter
                </a>
                . This includes frontier models from OpenAI, Anthropic, Google, DeepSeek, and
                others, as well as open-weight models. Our goal is to provide comprehensive
                coverage of the LLM landscape.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                Self-Funded
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                This project is currently self-funded as a community resource. Running LLM
                games at scale isn&apos;t cheap, but we believe this research is valuable
                enough to support independently. If you&apos;re interested in sponsoring
                more games or specific model matchups, feel free to reach out.
              </p>
            </div>
          </div>
        </section>

        {/* References */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
            References & Further Reading
          </h2>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            This project exists within a growing body of research on LLM behavior in social
            deduction games. Here are the key papers in this space:
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
                Satvik Golechha, Adrià Garriga-Alonso (2025)
              </p>
              <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
                The primary research this project is built on. Introduces a text-based Among Us
                environment for studying deceptive behavior in LLM agents. We directly use and
                <a href="https://github.com/haplesshero13/AmongLLMs" target="_blank" rel="noopener noreferrer">extend</a>
                their open-source implementation.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://arxiv.org/abs/2504.04072"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  arXiv Paper
                </a>
                <a
                  href="https://github.com/7vik/AmongUs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Original Code
                </a>
                <a
                  href="https://github.com/haplesshero13/AmongLLMs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Our Fork
                </a>
              </div>
            </div>

            {/* AMONGAGENTS */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                AMONGAGENTS: Evaluating Large Language Models in the Interactive Text-Based
                Social Deduction Game
              </h3>
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                Yizhou Chi, Lingjun Mao, Zineng Tang (2024)
              </p>
              <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
                Another text-based Among Us environment focusing on action planning, deception,
                and task collaboration. Analyzes how LLMs with different personalities perform
                and whether they truly comprehend strategic gameplay.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://arxiv.org/abs/2407.16521"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  arXiv Paper
                </a>
                <a
                  href="https://github.com/cyzus/among-agents"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  GitHub
                </a>
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
                effectively. Found that larger models don&apos;t necessarily have a persuasion advantage.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://arxiv.org/abs/2502.20426"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  arXiv Paper
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Disclaimer:</strong> This website is not affiliated with, funded by, or
            endorsed by FAR.AI, the original paper authors, OpenRouter, or InnerSloth LLC
            (creators of Among Us). This is an independent research project.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-center gap-6">
            <Link
              href="/"
              className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Leaderboard
            </Link>
            <Link
              href="/games"
              className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Games
            </Link>
            <a
              href="https://github.com/haplesshero13/AmongLLMs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
