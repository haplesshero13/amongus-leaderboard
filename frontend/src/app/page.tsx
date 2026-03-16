'use client';

import dynamic from 'next/dynamic';
import { PageLayout } from '../components/layout/PageLayout';
import { SeasonSelector } from '../components/features/SeasonSelector';
import { useSeasons } from '../lib/hooks/useSeasons';
import { useRankings } from '../lib/hooks/useRankings';

function getSeasonSuffix(selectedSeason: number): string {
  return `S${selectedSeason}`;
}

const RatingChart = dynamic(
  () => import('../components/features/RatingChart').then((mod) => ({ default: mod.RatingChart })),
  { ssr: false, loading: () => <div className="h-[500px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> }
);

export default function Home() {
  const { seasons, selectedSeason, isLoading, setSelectedSeason, selectedSeasonGameCount } = useSeasons();
  const { data } = useRankings(1, 100, selectedSeason);

  if (isLoading) {
    return (
      <PageLayout activePage="/">
        <div className="flex items-center justify-center p-12">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </PageLayout>
    );
  }

  const suffix = getSeasonSuffix(selectedSeason);
  const models = data?.data ?? [];

  return (
    <PageLayout activePage="/">
      {/* Season selector */}
      <SeasonSelector
        seasons={seasons}
        selectedVersion={selectedSeason}
        onSeasonChange={setSelectedSeason}
      />

      {/* Games played stat */}
      <div className="mb-6">
        <div className="inline-block rounded-xl bg-white px-5 py-3 shadow-sm dark:bg-gray-900">
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {selectedSeasonGameCount.toLocaleString()}
          </span>
          <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
            Games Played — {suffix}
          </span>
        </div>
      </div>

      {/* Rating chart */}
      <RatingChart models={models} />
    </PageLayout>
  );
}
