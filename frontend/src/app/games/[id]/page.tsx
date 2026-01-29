'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useGame, useGameLogs } from '@/lib/hooks/useGames';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { GameLogEntry, WINNER_LABELS, PLAYER_COLORS } from '@/types/game';

function PlayerBadge({ name, color, role }: { name: string; color: string; role: string }) {
  const bgColor = PLAYER_COLORS[color.toLowerCase()] || '#808080';
  const isImpostor = role === 'Impostor';

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-4 w-4 rounded-full border-2 border-white shadow"
        style={{ backgroundColor: bgColor }}
      />
      <span className={`text-sm font-medium ${isImpostor ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {name}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">({role})</span>
    </div>
  );
}

function ChatBubble({
  entry,
  showThinking,
}: {
  entry: GameLogEntry;
  showThinking: boolean;
}) {
  const bgColor = PLAYER_COLORS[entry.player_color.toLowerCase()] || '#808080';
  const isImpostor = entry.player_role === 'Impostor';

  // Parse the action to make it more readable
  const formatAction = (action: string) => {
    if (!action) return 'No action';

    // Handle SPEAK actions
    if (action.includes('SPEAK:')) {
      const speech = action.replace(/^.*SPEAK:\s*["']?/, '').replace(/["']?\s*$/, '');
      return speech;
    }

    // Handle numbered actions (e.g., "1. MOVE from X to Y")
    const cleanAction = action.replace(/^\d+\.\s*/, '');
    return cleanAction;
  };

  const isSpeech = entry.action?.includes('SPEAK');
  const formattedAction = formatAction(entry.action);

  return (
    <div className="mb-4">
      {/* Player info bar */}
      <div className="mb-1 flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: bgColor }}
        />
        <span
          className={`text-sm font-medium ${isImpostor ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}
        >
          {entry.player_name}
        </span>
        <span className="text-xs text-gray-400">
          Step {entry.step} @ {entry.location}
        </span>
      </div>

      {/* Chat bubble */}
      <div
        className={`ml-5 rounded-lg p-3 ${
          isSpeech
            ? 'border-l-4 bg-blue-50 dark:bg-blue-900/30'
            : 'bg-gray-100 dark:bg-gray-800'
        }`}
        style={{ borderLeftColor: isSpeech ? bgColor : undefined }}
      >
        <p className="text-sm text-gray-900 dark:text-gray-100">
          {isSpeech ? (
            <span className="italic">&ldquo;{formattedAction}&rdquo;</span>
          ) : (
            <span className="font-mono text-xs">{formattedAction}</span>
          )}
        </p>

        {showThinking && entry.thinking && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              Show thinking...
            </summary>
            <div className="mt-1 rounded bg-gray-200 p-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {entry.thinking}
            </div>
          </details>
        )}

        {showThinking && entry.memory && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              Show memory...
            </summary>
            <div className="mt-1 rounded bg-gray-200 p-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {entry.memory}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params.id as string;
  const [showThinking, setShowThinking] = useState(false);
  const [filterStep, setFilterStep] = useState<number | null>(null);

  const { data: game, isLoading: gameLoading, error: gameError } = useGame(gameId);
  const { data: logs, isLoading: logsLoading, error: logsError } = useGameLogs(gameId);

  const isLoading = gameLoading || logsLoading;
  const error = gameError || logsError;

  // Get unique steps for filtering
  const steps = logs ? [...new Set(logs.entries.map((e) => e.step))].sort((a, b) => a - b) : [];

  // Filter entries by step if selected
  const filteredEntries = logs?.entries.filter((e) =>
    filterStep === null ? true : e.step === filterStep
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Game Log
              </h1>
              <p className="mt-1 font-mono text-sm text-gray-600 dark:text-gray-400">
                {gameId}
              </p>
            </div>
            <Link
              href="/games"
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Back to Games
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading && <LoadingSpinner />}

        {error && (
          <ErrorMessage
            error={error}
            onRetry={() => window.location.reload()}
          />
        )}

        {!isLoading && !error && game && (
          <>
            {/* Game Summary */}
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    game.status === 'completed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : game.status === 'failed'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}
                >
                  {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                </span>
                {game.winner && (
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {WINNER_LABELS[game.winner]}
                  </span>
                )}
              </div>

              {/* Participants */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                    Impostors
                  </h3>
                  <div className="space-y-1">
                    {game.participants
                      .filter((p) => p.role === 'Impostor')
                      .map((p) => (
                        <div key={p.player_number} className="flex items-center gap-2">
                          <PlayerBadge name={p.model_name} color={p.player_color} role={p.role} />
                          {p.won !== null && (
                            <span className="text-xs">{p.won ? '(Won)' : '(Lost)'}</span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                    Crewmates
                  </h3>
                  <div className="space-y-1">
                    {game.participants
                      .filter((p) => p.role === 'Crewmate')
                      .map((p) => (
                        <div key={p.player_number} className="flex items-center gap-2">
                          <PlayerBadge name={p.model_name} color={p.player_color} role={p.role} />
                          {p.survived !== null && (
                            <span className="text-xs">
                              {p.survived ? '(Survived)' : '(Eliminated)'}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showThinking}
                  onChange={(e) => setShowThinking(e.target.checked)}
                  className="rounded"
                />
                Show AI thinking
              </label>

              {steps.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Step:</span>
                  <select
                    value={filterStep ?? ''}
                    onChange={(e) =>
                      setFilterStep(e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                  >
                    <option value="">All steps</option>
                    {steps.map((step) => (
                      <option key={step} value={step}>
                        Step {step}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Chat Log */}
            {logs && filteredEntries && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                {filteredEntries.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400">
                    No log entries available
                  </p>
                ) : (
                  filteredEntries.map((entry, index) => (
                    <ChatBubble
                      key={`${entry.step}-${entry.player_name}-${index}`}
                      entry={entry}
                      showThinking={showThinking}
                    />
                  ))
                )}
              </div>
            )}

            {!logs && !logsLoading && (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
                <p className="text-gray-500 dark:text-gray-400">
                  Game logs are not yet available. They will appear once the game completes.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
