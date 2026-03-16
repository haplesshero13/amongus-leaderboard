'use client';

import { PageLayout } from '../../components/layout/PageLayout';
import { Leaderboard } from '../../components/features/Leaderboard';
import { SeasonSelector } from '../../components/features/SeasonSelector';
import { useSeasons } from '../../lib/hooks/useSeasons';
import { useRankings } from '../../lib/hooks/useRankings';
import { getConservativeRating } from '../../types/leaderboard';

function getSeasonSuffix(selectedSeason: number): string {
  return `S${selectedSeason}`;
}

function StatsBar({ selectedSeason, seasonGameCount }: { selectedSeason: number; seasonGameCount: number }) {
  const { data, isLoading } = useRankings(1, 100, selectedSeason);

  const models = data?.data ?? [];
  const modelsWithImpostorGames = models.filter((m) => m.impostor_games > 0);
  const modelsWithCrewmateGames = models.filter((m) => m.crewmate_games > 0);

  const topImpostor = modelsWithImpostorGames.length > 0
    ? modelsWithImpostorGames.reduce((best, m) =>
      getConservativeRating(m.impostor_rating, m.impostor_sigma) >
        getConservativeRating(best.impostor_rating, best.impostor_sigma) ? m : best
    )
    : undefined;
  const topCrewmate = modelsWithCrewmateGames.length > 0
    ? modelsWithCrewmateGames.reduce((best, m) =>
      getConservativeRating(m.crewmate_rating, m.crewmate_sigma) >
        getConservativeRating(best.crewmate_rating, best.crewmate_sigma) ? m : best
    )
    : undefined;

  const suffix = getSeasonSuffix(selectedSeason);
  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isLoading ? '...' : formatNumber(models.length)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Models Ranked — {suffix}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(seasonGameCount)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Games Played — {suffix}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="text-xl font-bold text-red-600 dark:text-red-400 truncate">
            {isLoading ? '...' : (topImpostor?.model_name ?? '—')}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Top Impostor{' '}
            {topImpostor && !isLoading && (
              <span className="font-medium">
                ({getConservativeRating(topImpostor.impostor_rating, topImpostor.impostor_sigma)})
              </span>
            )}
            {' '}— {suffix}
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 truncate">
            {isLoading ? '...' : (topCrewmate?.model_name ?? '—')}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Top Crewmate{' '}
            {topCrewmate && !isLoading && (
              <span className="font-medium">
                ({getConservativeRating(topCrewmate.crewmate_rating, topCrewmate.crewmate_sigma)})
              </span>
            )}
            {' '}— {suffix}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { seasons, selectedSeason, isLoading, setSelectedSeason, selectedSeasonGameCount } = useSeasons();

  if (isLoading) {
    return (
      <PageLayout activePage="/leaderboard">
        <div className="flex items-center justify-center p-12">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePage="/leaderboard">
      {/* About section */}
      <div className="mb-8 space-y-6 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <div>
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            LM Deception Arena
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            A live leaderboard where we have frontier and open-weight LLMs compete against each other in a
            turn-based, text-only version of <em>Among Us</em>. Watch games live, review past games, and
            learn how language models exhibit deception,  persuasion, and social reasoning.
          </p>
        </div>
      </div>

      {/* Season selector */}
      <SeasonSelector
        seasons={seasons}
        selectedVersion={selectedSeason}
        onSeasonChange={setSelectedSeason}
      />

      {/* Stats banner */}
      <StatsBar selectedSeason={selectedSeason} seasonGameCount={selectedSeasonGameCount} />

      {/* Leaderboard */}
      <Leaderboard selectedSeason={selectedSeason} />
    </PageLayout>
  );
}
