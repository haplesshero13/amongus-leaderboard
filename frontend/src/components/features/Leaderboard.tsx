'use client';

import { useState } from 'react';
import { useRankings } from '../../lib/hooks/useRankings';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';
import { LeaderboardTable } from './LeaderboardTable';
import { LeaderboardCards } from './LeaderboardCards';

const ITEMS_PER_PAGE = 20;

export function Leaderboard() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useRankings(page, ITEMS_PER_PAGE);

  // Show loading spinner only on initial load
  if (isLoading && !data) {
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

  const totalPages = data.total_pages;
  const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(page * ITEMS_PER_PAGE, data.total);

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

      {/* Footer with pagination */}
      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        {/* Page info */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {startIndex}–{endIndex} of {data.total} models
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            {/* First page */}
            <button
              onClick={() => setPage(1)}
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
              onClick={() => setPage(p => Math.max(1, p - 1))}
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
                    onClick={() => setPage(pageNum as number)}
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
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
              onClick={() => setPage(totalPages)}
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
