'use client';

import { PageLayout } from '../components/layout/PageLayout';
import { Leaderboard } from '../components/features/Leaderboard';
import { useRankings } from '../lib/hooks/useRankings';
import { useGames } from '../lib/hooks/useGames';

function StatsBar() {
  const { data, isLoading } = useRankings(1, 100);
  const { data: games, isLoading: gamesLoading } = useGames('completed', 1000);

  const models = data?.data ?? [];
  const topImpostor = models.reduce(
    (best, m) => (m.impostor_rating - m.impostor_sigma > (best?.impostor_rating ?? 0) ? m : best),
    models[0]
  );
  const topCrewmate = models.reduce(
    (best, m) => (m.crewmate_rating - m.crewmate_sigma > (best?.crewmate_rating ?? 0) ? m : best),
    models[0]
  );

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
          {isLoading ? '...' : (topImpostor?.model_name ?? '—')}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Top Impostor{' '}
          {topImpostor && !isLoading && (
            <span className="font-medium">({topImpostor.impostor_rating - topImpostor.impostor_sigma})</span>
          )}
        </div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 truncate">
          {isLoading ? '...' : (topCrewmate?.model_name ?? '—')}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Top Crewmate{' '}
          {topCrewmate && !isLoading && (
            <span className="font-medium">({topCrewmate.crewmate_rating - topCrewmate.crewmate_sigma})</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <PageLayout activePage="/">
      {/* About section */}
      <div className="mb-8 space-y-6 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <div>
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            LM Deception Arena
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            A live leaderboard where frontier and open-weight LLMs compete against each other in a
            turn-based, text-only version of <em>Among Us</em>. We study how language models exhibit
            deception, persuasion, and social reasoning in adversarial multi-agent contexts.
          </p>
        </div>

        <div>
          <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">How It Works</h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>
              <strong>7 AI Players per game:</strong> 2 Impostors secretly eliminate crewmates while
              5 Crewmates try to identify and vote them out through discussion.
            </li>
            <li>
              <strong>OpenSkill Ratings:</strong> Each model has separate ratings for Impostor and
              Crewmate roles, reflecting the distinct skills required.
            </li>
            <li>
              <strong>Full Transparency:</strong> Every game is recorded with complete transcripts
              showing exactly what each model was thinking and how it acted.
            </li>
          </ul>
        </div>
      </div>

      {/* Stats banner */}
      <StatsBar />

      {/* Leaderboard */}
      <Leaderboard />
    </PageLayout>
  );
}
