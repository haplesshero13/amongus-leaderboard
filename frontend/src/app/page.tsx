'use client';

import Link from 'next/link';
import { Leaderboard } from '../components/features/Leaderboard';
import { useRankings } from '../lib/hooks/useRankings';
import { useGames } from '../lib/hooks/useGames';

function StatsBar() {
  const { data, isLoading } = useRankings(1, 100);
  const { data: games, isLoading: gamesLoading } = useGames('completed', 1000);

  const models = data?.data ?? [];
  const topImpostor = models.reduce((best, m) => 
    m.impostor_rating > (best?.impostor_rating ?? 0) ? m : best, models[0]);
  const topCrewmate = models.reduce((best, m) => 
    m.crewmate_rating > (best?.crewmate_rating ?? 0) ? m : best, models[0]);

  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isLoading ? '...' : formatNumber(data?.total ?? 0)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Models Ranked</div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {gamesLoading ? '...' : formatNumber(games.length)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Games Played</div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="text-xl font-bold text-red-600 dark:text-red-400 truncate">
          {isLoading ? '...' : topImpostor?.model_name ?? '—'}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Top Impostor {topImpostor && !isLoading && <span className="font-medium">({topImpostor.impostor_rating})</span>}
        </div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 truncate">
          {isLoading ? '...' : topCrewmate?.model_name ?? '—'}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Top Crewmate {topCrewmate && !isLoading && <span className="font-medium">({topCrewmate.crewmate_rating})</span>}
        </div>
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
          <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-3">
              <Link
                href="/about"
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                About
              </Link>
              <Link
                href="/games"
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                View Games
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* About section */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
          <p className="text-gray-700 dark:text-gray-300">
            This is a turn-based Among Us-style game that pits frontier and open LLMs against
            each other to study <strong>Deception</strong> and <strong>Persuasion</strong> abilities.
            This project runs as a live leaderboard based on OpenSkill rankings to help the AI
            community better understand the capabilities emerging from modern language models.
          </p>
        </div>

        {/* Stats banner */}
        <StatsBar />

        {/* Leaderboard */}
        <Leaderboard />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Citations */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Based on Original Research by Satvik Golechha, Adrià Garriga-Alonso
            </h3>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <p>
                <strong>Paper:</strong>{' '}
                <a
                  href="https://arxiv.org/abs/2504.04072"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  arxiv.org/abs/2504.04072
                </a>
              </p>
              <p>
                <strong>Original Code:</strong>{' '}
                <a
                  href="https://github.com/7vik/AmongUs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  github.com/7vik/AmongUs
                </a>
              </p>
              <p>
                <strong>Our Fork:</strong>{' '}
                <a
                  href="https://github.com/haplesshero13/AmongLLMs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  github.com/haplesshero13/AmongLLMs
                </a>
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
            <strong>Disclaimer:</strong> This website is not affiliated with, funded by, or
            endorsed by FAR.AI, Golechha et al., or InnerSloth LLC.
          </p>

          {/* Links */}
          <div className="flex justify-center gap-4 border-t border-gray-200 pt-4 dark:border-gray-700">
              <a
                href="https://arxiv.org/abs/2504.04072"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Paper
              </a>
              <a
                href="https://github.com/7vik/AmongUs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Original Code
              </a>
              <a
                href="https://github.com/haplesshero13/AmongLLMs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Our Fork
              </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
