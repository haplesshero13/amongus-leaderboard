'use client';

import { useState, useEffect, useCallback } from 'react';
import { LeaderboardResponse } from '@/types/leaderboard';
import { fetchLeaderboard } from '@/lib/api/leaderboard';

interface UseRankingsResult {
  data: LeaderboardResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRankings(
  page: number = 1,
  perPage: number = 20
): UseRankingsResult {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchLeaderboard(page, perPage);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
