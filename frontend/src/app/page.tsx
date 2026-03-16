'use client';

import { PageLayout } from '../components/layout/PageLayout';
import { useSeasons } from '../lib/hooks/useSeasons';
import { SeasonSelector } from '../components/features/SeasonSelector';

export default function Home() {
  const { seasons, selectedSeason, isLoading, setSelectedSeason, selectedSeasonGameCount } = useSeasons();

  if (isLoading) {
    return (
      <PageLayout activePage="/">
        <div className="flex items-center justify-center p-12">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePage="/">
      <SeasonSelector
        seasons={seasons}
        selectedVersion={selectedSeason}
        onSeasonChange={setSelectedSeason}
      />
      <div className="rounded-xl bg-white p-8 shadow-sm dark:bg-gray-900">
        <p className="text-center text-gray-500 dark:text-gray-400">
          Chart page coming soon — Games Played: {selectedSeasonGameCount}
        </p>
      </div>
    </PageLayout>
  );
}
