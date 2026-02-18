'use client';

import { useState, useMemo } from 'react';
import posthog from 'posthog-js';
import { useRankings } from '../../lib/hooks/useRankings';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';
import { LeaderboardTable } from './LeaderboardTable';
import { LeaderboardCards } from './LeaderboardCards';
import { SeasonSelector } from './SeasonSelector';
import type { SortField, SortDirection, ModelRanking } from '../../types/leaderboard';
import { getConservativeRating } from '../../types/leaderboard';

const ITEMS_PER_PAGE = 20;

interface LeaderboardProps {
  selectedSeason: number | null;
  onSeasonChange: (version: number | null) => void;
}

export function Leaderboard({ selectedSeason, onSeasonChange }: LeaderboardProps) {
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('overall_rating');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { data, isLoading, error, refetch } = useRankings(1, 1000, selectedSeason);

  const handlePageChange = (newPage: number) => {
    posthog.capture('leaderboard_page_changed', {
      from_page: page,
      to_page: newPage,
      total_pages: Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE),
      total_models: data?.total,
    });
    setPage(newPage);
  };

  const handleSeasonChange = (version: number | null) => {
    posthog.capture('season_changed', {
      from_season: selectedSeason,
      to_season: version,
    });
    onSeasonChange(version);
    setPage(1);
  };

  const handleSortChange = (field: SortField) => {
    const newDirection = field === sortField && sortDirection === 'desc' ? 'asc' : 'desc';
    posthog.capture('leaderboard_sort_changed', {
      sort_field: field,
      sort_direction: newDirection,
    });
    setSortField(field);
    setSortDirection(newDirection);
    setPage(1);
  };

  // Sort and paginate client-side
  const { sortedAndPaginated, totalModels } = useMemo(() => {
    if (!data || !data.data) {
      return { sortedAndPaginated: [], totalModels: 0 };
    }

    const sorted = [...data.data];

    // Sort based on selected field
    sorted.sort((a: ModelRanking, b: ModelRanking) => {
      let aValue: number, bValue: number;

      switch (sortField) {
        case 'overall_rating':
          aValue = getConservativeRating(a.overall_rating, a.overall_sigma);
          bValue = getConservativeRating(b.overall_rating, b.overall_sigma);
          break;
        case 'impostor_rating':
          aValue = getConservativeRating(a.impostor_rating, a.impostor_sigma);
          bValue = getConservativeRating(b.impostor_rating, b.impostor_sigma);
          break;
        case 'crewmate_rating':
          aValue = getConservativeRating(a.crewmate_rating, a.crewmate_sigma);
          bValue = getConservativeRating(b.crewmate_rating, b.crewmate_sigma);
          break;
        case 'winrate':
          aValue = a.win_rate;
          bValue = b.win_rate;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });

    const total = sorted.length;
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginated = sorted.slice(startIdx, endIdx);

    return { sortedAndPaginated: paginated, totalModels: total };
  }, [data, sortField, sortDirection, page]);

  // Show loading spinner only on initial load
  if (isLoading && !data) {
    return (
      <div>
        <SeasonSelector selectedVersion={selectedSeason} onSeasonChange={handleSeasonChange} />
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SeasonSelector selectedVersion={selectedSeason} onSeasonChange={handleSeasonChange} />
        <ErrorMessage error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div>
        <SeasonSelector selectedVersion={selectedSeason} onSeasonChange={handleSeasonChange} />
        <div className="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
          No rankings available yet for this season
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalModels / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(page * ITEMS_PER_PAGE, totalModels);

  return (
    <div>
      <div className="mb-6">
        <SeasonSelector selectedVersion={selectedSeason} onSeasonChange={handleSeasonChange} />
      </div>

      {/* Desktop view */}
      <div className="hidden md:block">
        <LeaderboardTable
          rankings={sortedAndPaginated}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSortChange}
        />
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        <LeaderboardCards rankings={sortedAndPaginated} />
      </div>

      {/* Footer with pagination */}
      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        {/* Page info */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {startIndex}–{endIndex} of {totalModels} models
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            {/* First page */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={page === 1 || isLoading}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors
                disabled:cursor-not-allowed disabled:opacity-40
                enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800
                text-gray-700 dark:text-gray-300"
              title="First page"
            >
              ««
            </button>

            {/* Previous page */}
            <button
              onClick={() => handlePageChange(Math.max(1, page - 1))}
              disabled={page === 1 || isLoading}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors
                disabled:cursor-not-allowed disabled:opacity-40
                enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800
                text-gray-700 dark:text-gray-300"
              title="Previous page"
            >
              «
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {generatePageNumbers(page, totalPages).map((pageNum, idx) => (
                pageNum === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                    …
                  </span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum as number)}
                    disabled={isLoading}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors
                      ${page === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }
                      disabled:cursor-not-allowed`}
                  >
                    {pageNum}
                  </button>
                )
              ))}
            </div>

            {/* Next page */}
            <button
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || isLoading}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors
                disabled:cursor-not-allowed disabled:opacity-40
                enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800
                text-gray-700 dark:text-gray-300"
              title="Next page"
            >
              »
            </button>

            {/* Last page */}
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={page === totalPages || isLoading}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors
                disabled:cursor-not-allowed disabled:opacity-40
                enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800
                text-gray-700 dark:text-gray-300"
              title="Last page"
            >
              »»
            </button>
          </div>
        )}
      </div>

      {/* Loading overlay for page transitions */}
      {isLoading && data && (
        <div className="mt-4 flex justify-center">
          <div className="animate-pulse text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Generate an array of page numbers with ellipsis for large ranges
 * Shows: first, last, current, and 1 page on each side of current
 */
function generatePageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    // Show all pages if 7 or fewer
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];

  // Always show first page
  pages.push(1);

  // Calculate range around current page
  const rangeStart = Math.max(2, currentPage - 1);
  const rangeEnd = Math.min(totalPages - 1, currentPage + 1);

  // Add ellipsis if there's a gap after 1
  if (rangeStart > 2) {
    pages.push('...');
  }

  // Add pages in range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  // Add ellipsis if there's a gap before last page
  if (rangeEnd < totalPages - 1) {
    pages.push('...');
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}
