'use client';

import { PageLayout } from '../../components/layout/PageLayout';
import { Leaderboard } from '../../components/features/Leaderboard';
import { SeasonSelector } from '../../components/features/SeasonSelector';
import { StatsBar } from '../../components/features/StatsBar';
import { useSeasons } from '../../lib/hooks/useSeasons';
import { useRankings } from '../../lib/hooks/useRankings';

export default function LeaderboardPage() {
  const { seasons, selectedSeason, isLoading, setSelectedSeason, selectedSeasonGameCount } = useSeasons();
  const { data, isLoading: isRankingsLoading } = useRankings(1, 100, selectedSeason);

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
      <StatsBar
        selectedSeason={selectedSeason}
        seasonGameCount={selectedSeasonGameCount}
        models={data?.data ?? []}
        isLoading={isRankingsLoading}
      />

      {/* Leaderboard */}
      <Leaderboard selectedSeason={selectedSeason} />
    </PageLayout>
  );
}
