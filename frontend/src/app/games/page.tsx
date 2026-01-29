'use client';

import Link from 'next/link';
import { useGames } from '@/lib/hooks/useGames';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Game, WINNER_LABELS } from '@/types/game';

function GameStatusBadge({ status }: { status: Game['status'] }) {
  const styles: Record<Game['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function GameCard({ game }: { game: Game }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString();
  };

  const impostors = game.participants.filter((p) => p.role === 'Impostor');
  const crewmates = game.participants.filter((p) => p.role === 'Crewmate');

  return (
    <Link
      href={`/games/${game.game_id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
          {game.game_id.slice(0, 8)}...
        </span>
        <GameStatusBadge status={game.status} />
      </div>

      {game.status === 'completed' && game.winner && (
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {WINNER_LABELS[game.winner] || `Winner: ${game.winner}`}
          </p>
        </div>
      )}

      {game.status === 'failed' && game.error_message && (
        <div className="mb-3">
          <p className="text-sm text-red-600 dark:text-red-400">
            {game.error_message.slice(0, 100)}
            {game.error_message.length > 100 ? '...' : ''}
          </p>
        </div>
      )}

      <div className="mb-3 space-y-2">
        <div>
          <span className="text-xs font-medium text-red-600 dark:text-red-400">Impostors: </span>
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {impostors.map((p) => p.model_name).join(', ') || '—'}
          </span>
        </div>
        <div>
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Crewmates: </span>
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {crewmates.map((p) => p.model_name).join(', ') || '—'}
          </span>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        {game.ended_at ? (
          <span>Ended: {formatDate(game.ended_at)}</span>
        ) : game.started_at ? (
          <span>Started: {formatDate(game.started_at)}</span>
        ) : (
          <span>Pending</span>
        )}
      </div>
    </Link>
  );
}

export default function GamesPage() {
  const { data: games, isLoading, error } = useGames();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Game History
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Browse past Among Us games between AI models
              </p>
            </div>
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Back to Leaderboard
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading && <LoadingSpinner />}

        {error && (
          <ErrorMessage
            error={error}
            onRetry={() => window.location.reload()}
          />
        )}

        {!isLoading && !error && games.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">
              No games found. Games will appear here once they have been played.
            </p>
          </div>
        )}

        {!isLoading && !error && games.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard key={game.game_id} game={game} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
