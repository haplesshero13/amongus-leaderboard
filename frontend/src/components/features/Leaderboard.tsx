'use client';

import { useRankings } from '../../lib/hooks/useRankings';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';
import { LeaderboardTable } from './LeaderboardTable';
import { LeaderboardCards } from './LeaderboardCards';

export function Leaderboard() {
  const { data, isLoading, error, refetch } = useRankings();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
        No rankings available
      </div>
    );
  }

  return (
    <div>
      {/* Desktop view */}
      <div className="hidden md:block">
        <LeaderboardTable rankings={data.data} />
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        <LeaderboardCards rankings={data.data} />
      </div>

      {/* Footer stats */}
      <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        Showing {data.data.length} of {data.total} models
      </div>
    </div>
  );
}
