'use client';

import { useState, useEffect } from 'react';
import { Season } from '../../types/leaderboard';
import { fetchSeasons } from '../api/leaderboard';

interface UseSeasonsResult {
  seasons: Season[];
  isLoading: boolean;
  error: Error | null;
}

export function useSeasons(): UseSeasonsResult {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchSeasons()
      .then((data) => {
        if (mounted) {
          // Sort descending so current season is first
          setSeasons(data.sort((a, b) => b.version - a.version));
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch seasons'));
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { seasons, isLoading, error };
}
