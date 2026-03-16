'use client';

import type { ModelRanking } from '../../types/leaderboard';
import { getConservativeRating } from '../../types/leaderboard';
import { leaderboardColorClasses } from '../../lib/theme/amongUsPalette';

interface StatsBarProps {
  selectedSeason: number;
  seasonGameCount: number;
  models: ModelRanking[];
  isLoading?: boolean;
}

function getSeasonSuffix(selectedSeason: number): string {
  return `S${selectedSeason}`;
}

export function StatsBar({
  selectedSeason,
  seasonGameCount,
  models,
  isLoading = false,
}: StatsBarProps) {
  const modelsWithImpostorGames = models.filter((model) => model.impostor_games > 0);
  const modelsWithCrewmateGames = models.filter((model) => model.crewmate_games > 0);

  const bestImpostor = modelsWithImpostorGames.length > 0
    ? modelsWithImpostorGames.reduce((best, model) =>
      getConservativeRating(model.impostor_rating, model.impostor_sigma) >
        getConservativeRating(best.impostor_rating, best.impostor_sigma) ? model : best
    )
    : undefined;
  const bestCrewmate = modelsWithCrewmateGames.length > 0
    ? modelsWithCrewmateGames.reduce((best, model) =>
      getConservativeRating(model.crewmate_rating, model.crewmate_sigma) >
        getConservativeRating(best.crewmate_rating, best.crewmate_sigma) ? model : best
    )
    : undefined;

  const suffix = getSeasonSuffix(selectedSeason);
  const formatNumber = (value: number) => value.toLocaleString();

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
          <div className={`text-xl font-bold truncate ${leaderboardColorClasses.impostorValue}`}>
            {isLoading ? '...' : (bestImpostor?.model_name ?? '—')}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Best Impostor{' '}
            {bestImpostor && !isLoading && (
              <span className="font-medium">
                ({getConservativeRating(bestImpostor.impostor_rating, bestImpostor.impostor_sigma)})
              </span>
            )}
            {' '}— {suffix}
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className={`text-xl font-bold truncate ${leaderboardColorClasses.crewmateValue}`}>
            {isLoading ? '...' : (bestCrewmate?.model_name ?? '—')}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Best Crewmate{' '}
            {bestCrewmate && !isLoading && (
              <span className="font-medium">
                ({getConservativeRating(bestCrewmate.crewmate_rating, bestCrewmate.crewmate_sigma)})
              </span>
            )}
            {' '}— {suffix}
          </div>
        </div>
      </div>
    </div>
  );
}
