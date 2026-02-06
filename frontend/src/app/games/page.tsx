'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PageLayout } from '@/components/layout/PageLayout';
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

  const handleGameCardClick = () => {
    posthog.capture('game_card_clicked', {
      game_id: game.game_id,
      game_status: game.status,
      winner: game.winner,
      impostor_models: impostors.map((p) => p.model_name),
      crewmate_models: crewmates.map((p) => p.model_name),
      participant_count: game.participants.length,
    });
  };

  return (
    <Link
      href={`/games/${game.game_id}`}
      onClick={handleGameCardClick}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
            {game.game_id.slice(0, 8)}...
          </span>
          {game.engine_version != null && (
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium
              ${game.engine_version === 0
                ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
              }`}>
              S{game.engine_version}
            </span>
          )}
        </div>
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

function GamesContent() {
  const searchParams = useSearchParams();
  const models = (searchParams.get('models') ?? '').split(',').filter(Boolean);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: games, isLoading, error } = useGames(undefined, 100, undefined);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get unique models from all games
  const uniqueModels = Array.from(
    new Map(
      games
        .flatMap((g) => g.participants)
        .map((p) => [p.model_id, { model_id: p.model_id, model_name: p.model_name }])
    ).values()
  ).sort((a, b) => a.model_name.localeCompare(b.model_name));

  // Filter games by selected models - show only games where ALL selected models participate
  const filteredGames = models.length === 0
    ? games.filter((g) => g.status !== 'failed')
    : games.filter((g) => {
        // Every selected model must be present in this game
        const gameHasAllSelectedModels = models.every((modelId) =>
          g.participants.some((p) => p.model_id === modelId)
        );
        return gameHasAllSelectedModels && g.status !== 'failed';
      });

  const handleModelToggle = (modelId: string) => {
    const isRemoving = models.includes(modelId);
    const newModels = isRemoving
      ? models.filter((m) => m !== modelId)
      : [...models, modelId];

    const modelName = uniqueModels.find((m) => m.model_id === modelId)?.model_name || modelId;

    posthog.capture('game_filter_applied', {
      action: isRemoving ? 'removed' : 'added',
      model_id: modelId,
      model_name: modelName,
      total_filters: newModels.length,
      selected_models: newModels,
    });

    const params = new URLSearchParams(searchParams);
    if (newModels.length === 0) {
      params.delete('models');
    } else {
      params.set('models', newModels.join(','));
    }

    const newUrl = `/games?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  return (
    <PageLayout activePage="/games">
      {/* Model Filter */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-100">
          Filter by Models:
        </label>
        
        <div className="relative" ref={dropdownRef}>
          <div 
            className="flex min-h-[42px] w-full flex-wrap items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm cursor-text dark:border-gray-600 dark:bg-gray-900 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
            onClick={() => setIsDropdownOpen(true)}
          >
            {models.length === 0 && (
              <span className="text-gray-500 dark:text-gray-400">Select models...</span>
            )}
            
            {models.map((modelId) => {
              const modelName = uniqueModels.find((m) => m.model_id === modelId)?.model_name || modelId;
              return (
                <span 
                  key={modelId}
                  className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                >
                  {modelName}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModelToggle(modelId);
                    }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>

          {isDropdownOpen && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white/45 py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800/45 backdrop-blur">
              {uniqueModels.length === 0 ? (
                <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No models available
                </div>
              ) : (
                uniqueModels.map((model) => (
                  <label
                    key={model.model_id}
                    className="flex cursor-pointer items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={models.includes(model.model_id)}
                      onChange={() => handleModelToggle(model.model_id)}
                      className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {model.model_name}
                    </span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {models.length > 0 && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                posthog.capture('game_filter_cleared', {
                  cleared_models: models,
                  cleared_count: models.length,
                });
                window.history.replaceState({}, '', '/games');
                // Force re-render by clearing local state via URL update
              }}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {isLoading && <LoadingSpinner />}

      {error && <ErrorMessage error={error} onRetry={() => window.location.reload()} />}

      {!isLoading && !error && filteredGames.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-600 dark:text-gray-400">
            {models.length > 0
              ? `No games found where all selected models participated together. Try selecting fewer models or clearing the filter.`
              : 'No games found. Games will appear here once they have been played.'}
          </p>
        </div>
      )}

      {!isLoading && !error && filteredGames.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGames.map((game) => (
            <GameCard key={game.game_id} game={game} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}

export default function GamesPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <GamesContent />
    </Suspense>
  );
}
