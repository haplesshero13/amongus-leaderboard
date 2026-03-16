'use client';

import { Season } from '../../types/leaderboard';

interface SeasonSelectorProps {
  seasons: Season[];
  selectedVersion: number;
  onSeasonChange: (version: number) => void;
}

export function SeasonSelector({ seasons, selectedVersion, onSeasonChange }: SeasonSelectorProps) {
  if (seasons.length <= 1) {
    return null;
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {seasons.map((season) => {
        const isSelected = selectedVersion === season.version;
        return (
          <button
            key={season.version}
            onClick={() => onSeasonChange(season.version)}
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
