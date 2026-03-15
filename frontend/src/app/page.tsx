'use client';

import { useState, useCallback } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Leaderboard } from '../components/features/Leaderboard';
import { useRankings } from '../lib/hooks/useRankings';
import { useGames } from '../lib/hooks/useGames';
import { getConservativeRating } from '../types/leaderboard';

function StatsBar({ selectedSeason, seasonLabel }: { selectedSeason: number | null; seasonLabel: string | null }) {
  const { data, isLoading } = useRankings(1, 100, selectedSeason);
  const { data: games, isLoading: gamesLoading } = useGames(
    'completed',
    1000,
    undefined,
    selectedSeason
  );

  const models = data?.data ?? [];
  const topImpostor = models.length > 0
    ? models.reduce((best, m) =>
      getConservativeRating(m.impostor_rating, m.impostor_sigma) >
        getConservativeRating(best.impostor_rating, best.impostor_sigma) ? m : best
    )
    : undefined;
  const topCrewmate = models.length > 0
    ? models.reduce((best, m) =>
      getConservativeRating(m.crewmate_rating, m.crewmate_sigma) >
        getConservativeRating(best.crewmate_rating, best.crewmate_sigma) ? m : best
    )
    : undefined;

  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className="mb-8">
      {seasonLabel && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {seasonLabel}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              <span className="font-medium">
                ({getConservativeRating(topImpostor.impostor_rating, topImpostor.impostor_sigma)})
              </span>
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
              <span className="font-medium">
                ({getConservativeRating(topCrewmate.crewmate_rating, topCrewmate.crewmate_sigma)})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedSeasonLabel, setSelectedSeasonLabel] = useState<string | null>(null);

  const handleSeasonChange = useCallback((version: number | null, label: string | null) => {
    setSelectedSeason(version);
    setSelectedSeasonLabel(label);
  }, []);

  return (
    <PageLayout activePage="/">
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

      {/* Stats banner */}
      <StatsBar selectedSeason={selectedSeason} seasonLabel={selectedSeasonLabel} />

      {/* Leaderboard */}
      <Leaderboard
        selectedSeason={selectedSeason}
        onSeasonChange={handleSeasonChange}
      />
    </PageLayout>
  );
}
