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
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">
          This is a turn-based Among Us-style game that pits frontier and open LLMs against each
          other to study <strong>Deception</strong> and <strong>Persuasion</strong> abilities. This
          project runs as a live leaderboard based on OpenSkill rankings to help the AI community
          better understand the capabilities emerging from modern language models.
        </p>
      </div>

      {/* Stats banner */}
      <StatsBar />

      {/* Leaderboard */}
      <Leaderboard />
    </PageLayout>
  );
}
