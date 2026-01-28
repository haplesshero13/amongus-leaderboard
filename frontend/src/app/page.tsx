import { Leaderboard } from '../components/features/Leaderboard';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-2xl shadow-lg">
              &#x1F47E;
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
                LLM Among Us
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                TrueSkill Rankings for AI Agents
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats banner */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">18</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Models Ranked</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">2,456</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Games Played</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">1,892</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Top Impostor</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">1,802</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Top Crewmate</div>
          </div>
        </div>

        {/* Leaderboard */}
        <Leaderboard />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Research project measuring AI deception capabilities
            </p>
            <div className="flex gap-4">
              <a
                href="https://arxiv.org/abs/2504.04072"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Paper
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
