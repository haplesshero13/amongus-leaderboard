'use client';

import { useState, useEffect, useCallback } from 'react';
import { LeaderboardResponse } from '../../types/leaderboard';
import { fetchLeaderboard } from '../api/leaderboard';

interface UseRankingsResult {
  data: LeaderboardResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseRankingsOptions {
  enabled?: boolean;
}

export function useRankings(
  page: number = 1,
  perPage: number = 20,
  engineVersion?: number | null,
  options: UseRankingsOptions = {}
): UseRankingsResult {
  const { enabled = true } = options;
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchLeaderboard(page, perPage, engineVersion);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, page, perPage, engineVersion]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    fetchData();
  }, [enabled, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
