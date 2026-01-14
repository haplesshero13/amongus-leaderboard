interface RankBadgeProps {
  rank: number;
}

export function RankBadge({ rank }: RankBadgeProps) {
  if (rank === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-lg shadow-yellow-500/30">
        <span className="text-lg">&#x1F947;</span>
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700 shadow-lg shadow-gray-400/30">
        <span className="text-lg">&#x1F948;</span>
      </div>
    );
  }

  if (rank === 3) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 shadow-lg shadow-amber-600/30">
        <span className="text-lg">&#x1F949;</span>
      </div>
    );
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
      {rank}
    </div>
  );
}

interface RankChangeProps {
  change: number;
}

export function RankChange({ change }: RankChangeProps) {
  if (change > 0) {
    return (
      <div className="flex items-center gap-0.5 text-sm font-medium text-green-600 dark:text-green-400">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
            clipRule="evenodd"
          />
        </svg>
        <span>{change}</span>
      </div>
    );
  }

  if (change < 0) {
    return (
      <div className="flex items-center gap-0.5 text-sm font-medium text-red-600 dark:text-red-400">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
            clipRule="evenodd"
          />
        </svg>
        <span>{Math.abs(change)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 text-sm font-medium text-gray-400">
      <span className="text-lg leading-none">&#8212;</span>
    </div>
  );
}
