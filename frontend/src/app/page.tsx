'use client';

import dynamic from 'next/dynamic';
import { PageLayout } from '../components/layout/PageLayout';
import { SeasonSelector } from '../components/features/SeasonSelector';
import { StatsBar } from '../components/features/StatsBar';
import { useSeasons } from '../lib/hooks/useSeasons';
import { useRankings } from '../lib/hooks/useRankings';

const RatingChart = dynamic(
  () => import('../components/features/RatingChart').then((mod) => ({ default: mod.RatingChart })),
  { ssr: false, loading: () => <div className="h-[500px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> }
);

export default function Home() {
  const { seasons, selectedSeason, isLoading, setSelectedSeason, selectedSeasonGameCount } = useSeasons();
  const { data, isLoading: isRankingsLoading } = useRankings(1, 100, selectedSeason);

  if (isLoading || (isRankingsLoading && !data)) {
    return (
      <PageLayout activePage="/">
        <div className="flex items-center justify-center p-12">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </PageLayout>
    );
  }

  const models = data?.data ?? [];

  return (
    <PageLayout activePage="/">
      {/* Season selector */}
      <SeasonSelector
        seasons={seasons}
        selectedVersion={selectedSeason}
        onSeasonChange={setSelectedSeason}
      />

      <StatsBar
        selectedSeason={selectedSeason}
        seasonGameCount={selectedSeasonGameCount}
        models={models}
        isLoading={isRankingsLoading && !data}
      />

      {/* Rating chart */}
      <RatingChart models={models} />
    </PageLayout>
  );
}
