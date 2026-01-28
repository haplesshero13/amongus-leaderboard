'use client';

import { Leaderboard } from '../components/features/Leaderboard';
import { useRankings } from '../lib/hooks/useRankings';

function StatsBar() {
  const { data, isLoading } = useRankings(1, 100);

  const stats = {
    modelsRanked: data?.total ?? 0,
    gamesPlayed: data?.data.reduce((sum, m) => sum + m.games_played, 0) ?? 0,
    topImpostor: data?.data.reduce((max, m) => Math.max(max, m.impostor_rating), 0) ?? 0,
    topCrewmate: data?.data.reduce((max, m) => Math.max(max, m.crewmate_rating), 0) ?? 0,
  };

  const formatNumber = (n: number) => n.toLocaleString();
  const formatRating = (n: number) => Math.round(n).toLocaleString();

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isLoading ? '...' : formatNumber(stats.modelsRanked)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Models Ranked</div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isLoading ? '...' : formatNumber(stats.gamesPlayed)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Games Played</div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
          {isLoading ? '...' : formatRating(stats.topImpostor)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Top Impostor</div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
          {isLoading ? '...' : formatRating(stats.topCrewmate)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Top Crewmate</div>
      </div>
    </div>
  );
}

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
                LM Deception Arena
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                OpenSkill Rankings for AI Agents
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats banner */}
        <StatsBar />

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
