'use client';

import { useState, useEffect } from 'react';
import { Season } from '../../types/leaderboard';
import { fetchSeasons } from '../../lib/api/leaderboard';

interface SeasonSelectorProps {
  selectedVersion: number | null;
  onSeasonChange: (version: number | null, label: string | null) => void;
}

export function SeasonSelector({ selectedVersion, onSeasonChange }: SeasonSelectorProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetchSeasons()
      .then((data) => {
        if (!isMounted) return;
        // Sort descending so current season is first
        const sorted = data.sort((a, b) => b.version - a.version);
        setSeasons(sorted);
        // Auto-select the latest season on initial mount so the stats bar
        // and leaderboard are scoped to the current season from the start.
        // Only auto-select when there is no explicit selection yet.
        if (sorted.length > 0 && selectedVersion === null) {
          onSeasonChange(sorted[0].version, sorted[0].label);
        }
      })
      .catch(() => {
        // Silently fail — selector just won't show
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading || seasons.length <= 1) {
    return null;
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {seasons.map((season) => {
        const isSelected = selectedVersion === season.version ||
          (selectedVersion === null && season === seasons[0]);

        return (
          <button
            key={season.version}
            onClick={() => onSeasonChange(season.version, season.label)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${isSelected
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
          >
            {season.label}
            <span className={`ml-2 text-xs ${isSelected ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
              {season.game_count} games
            </span>
          </button>
        );
      })}
    </div>
  );
}
