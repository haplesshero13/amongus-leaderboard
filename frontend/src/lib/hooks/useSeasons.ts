'use client';

import { useState, useEffect, useCallback } from 'react';
import { Season } from '../../types/leaderboard';
import { fetchSeasons } from '../api/leaderboard';

interface UseSeasonsReturn {
  seasons: Season[];
  selectedSeason: number;
  selectedSeasonLabel: string | null;
  selectedSeasonGameCount: number;
  isLoading: boolean;
  setSelectedSeason: (version: number) => void;
}

export function useSeasons(): UseSeasonsReturn {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeasonState] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchSeasons()
      .then((data) => {
        if (!isMounted) return;
        const sorted = data.sort((a, b) => b.version - a.version);
        setSeasons(sorted);
        if (sorted.length > 0) {
          setSelectedSeasonState(sorted[0].version);
          setIsLoading(false);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const setSelectedSeason = useCallback((version: number) => {
    setSelectedSeasonState(version);
  }, []);

  const selectedSeasonData = seasons.find((s) => s.version === selectedSeason);

  return {
    seasons,
    selectedSeason,
    selectedSeasonLabel: selectedSeasonData?.label ?? null,
    selectedSeasonGameCount: selectedSeasonData?.game_count ?? 0,
    isLoading,
    setSelectedSeason,
  };
}
