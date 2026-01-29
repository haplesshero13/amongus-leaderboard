'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Markdown from 'react-markdown';
import { useGame, useGameLogs } from '@/lib/hooks/useGames';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { GameLogEntry, RawAgentLog, WINNER_LABELS, PLAYER_COLORS, GameSummary, PlayerSummary } from '@/types/game';

/**
 * Parse raw agent logs into display-friendly entries
 */
function parseAgentLogs(rawLogs: RawAgentLog[]): GameLogEntry[] {
  return rawLogs.map((log) => {
    const player = log.player || {};
    const interaction = log.interaction || {};
    const response = interaction.response;

    // Extract player name and color from name (e.g., "Player 1: brown")
    const playerName = player.name || 'Unknown';
    let playerColor = 'gray';
    if (playerName.includes(':')) {
      playerColor = playerName.split(':')[1].trim();
    }

    // Extract action from response - ensure it's always a string
    let action = '';
    if (typeof response === 'string') {
      action = response;
    } else if (response && typeof response === 'object') {
      // Try multiple possible keys for action
      const topLevelAction = response.Action || response.action;
      if (typeof topLevelAction === 'string') {
        action = topLevelAction;
      }

      // If action is still empty, check Thinking Process for action
      if (!action) {
        const thinkingProcess = response['Thinking Process'];
        if (thinkingProcess && typeof thinkingProcess === 'object' && 'action' in thinkingProcess) {
          const tpAction = thinkingProcess.action;
          action = typeof tpAction === 'string' ? tpAction : '';
        }
      }
    }
    // Final safety: ensure action is always a string
    if (typeof action !== 'string') {
      action = String(action || '');
    }

    // Extract thinking process - ensure it's always a string or null
    let thinking: string | null = null;
    if (response && typeof response === 'object') {
      const thinkingVal = response['Thinking Process'];
      if (thinkingVal) {
        if (typeof thinkingVal === 'string') {
          thinking = thinkingVal;
        } else if (typeof thinkingVal === 'object') {
          const thought = thinkingVal.thought;
          thinking = typeof thought === 'string' ? thought : JSON.stringify(thinkingVal);
        }
      }
    }

    // Extract memory - ensure it's always a string or null
    let memory: string | null = null;
    if (response && typeof response === 'object') {
      const memoryVal = response['Condensed Memory'];
      if (typeof memoryVal === 'string') {
        memory = memoryVal;
      } else if (memoryVal) {
        memory = JSON.stringify(memoryVal);
      }
    }

    // Extract prompt info for debugging/full view
    const prompt = interaction.prompt;
    const rawPrompt = prompt?.['All Info'] || null;

    return {
      step: log.step ?? 0,
      timestamp: log.timestamp || '',
      player_name: playerName,
      player_color: playerColor,
      player_role: player.identity || 'Unknown',
      model: player.model || 'Unknown',
      location: player.location || 'Unknown',
      action,
      thinking,
      memory,
      raw_prompt: rawPrompt || undefined,
      full_response: interaction.full_response || undefined,
    };
  });
}

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
  hideThinking,
}: {
  entry: GameLogEntry;
  hideThinking: boolean;
}) {
  const bgColor = PLAYER_COLORS[entry.player_color.toLowerCase()] || '#808080';
  const isImpostor = entry.player_role === 'Impostor';

  // Extract player number from name (e.g., "Player 1: brown" -> "1")
  const playerNumber = entry.player_name.match(/Player (\d+)/)?.[1] || '?';

  // Format model name for display (shorten if too long)
  const formatModelName = (model: string) => {
    // Remove common prefixes like "meta-llama/" or "openai/"
    const shortName = model.replace(/^[^/]+\//, '');
    // Truncate if still too long
    return shortName.length > 30 ? shortName.slice(0, 27) + '...' : shortName;
  };

  // Parse the action to make it more readable
  const formatAction = (action: string) => {
    if (!action) return 'No action recorded';

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
    <div className="group flex gap-3 py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
          style={{ backgroundColor: bgColor }}
        >
          {playerNumber}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row with player info */}
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {/* Player identifier */}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Player {playerNumber}
          </span>

          {/* Color badge */}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: bgColor }}
          >
            {entry.player_color}
          </span>

          {/* Role badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isImpostor
                ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
            }`}
          >
            {entry.player_role}
          </span>

          {/* Model name */}
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
            {formatModelName(entry.model)}
          </span>
        </div>

        {/* Context info */}
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-2">
          <span>Step {entry.step}</span>
          <span>•</span>
          <span>{entry.location}</span>
          {entry.timestamp && (
            <>
              <span>•</span>
              <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
            </>
          )}
        </div>

        {/* Message bubble */}
        <div
          className="rounded-lg px-4 py-3 inline-block max-w-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-l-4"
          style={{ borderLeftColor: bgColor }}
        >
          {isSpeech ? (
            <p className="text-base">&ldquo;{formattedAction}&rdquo;</p>
          ) : (
            <div className="text-base prose prose-sm dark:prose-invert max-w-none">
              <Markdown>{formattedAction}</Markdown>
            </div>
          )}
        </div>

        {/* Expandable sections for thinking/memory */}
        {!hideThinking && (entry.thinking || entry.memory || entry.full_response) && (
          <div className="mt-2 space-y-2">
            {entry.thinking && (
              <details className="group/details" open>
                <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1">
                  <svg className="w-4 h-4 transition-transform group-open/details:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Thinking Process
                </summary>
                <div className="mt-2 ml-5 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border-l-2 border-amber-400 text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{entry.thinking}</Markdown>
                </div>
              </details>
            )}

            {entry.memory && (
              <details className="group/details" open>
                <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1">
                  <svg className="w-4 h-4 transition-transform group-open/details:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Condensed Memory
                </summary>
                <div className="mt-2 ml-5 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border-l-2 border-purple-400 text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{entry.memory}</Markdown>
                </div>
              </details>
            )}

            {entry.full_response && (
              <details className="group/details">
                <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1">
                  <svg className="w-4 h-4 transition-transform group-open/details:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Full Model Response
                </summary>
                <div className="mt-2 ml-5 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border-l-2 border-gray-400 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                  {entry.full_response}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GameEndBanner({ winner, winnerReason }: { winner: number; winnerReason: string | null }) {
  const isImpostorWin = winner === 1 || winner === 4;

  return (
    <div className={`mt-6 rounded-lg border-2 p-6 text-center ${
      isImpostorWin
        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
        : 'border-green-500 bg-green-50 dark:bg-green-900/20'
    }`}>
      <div className="text-2xl font-bold mb-2">
        GAME END
      </div>
      <div className={`text-lg font-semibold ${
        isImpostorWin ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
      }`}>
        {WINNER_LABELS[winner] || 'Unknown outcome'}
      </div>
      {winnerReason && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {winnerReason}
        </div>
      )}
    </div>
  );
}

// Helper to extract color from summary
function getPlayerColorFromSummary(summary: GameSummary, playerNumber: number): string {
  const playerKey = `Player ${playerNumber}`;
  const playerData = summary[playerKey];

  // Runtime check to distinguish PlayerSummary from GameConfig/number/string
  if (
    playerData &&
    typeof playerData === 'object' &&
    'color' in playerData
  ) {
    return (playerData as PlayerSummary).color;
  }

  // Try parsing name if color field missing
  if (
    playerData &&
    typeof playerData === 'object' &&
    'name' in playerData
  ) {
    const name = (playerData as PlayerSummary).name;
    if (typeof name === 'string' && name.includes(':')) {
      const parts = name.split(':');
      if (parts.length > 1) return parts[1].trim();
    }
  }
  return 'gray';
}

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params.id as string;
  // Default to showing thinking (hideThinking = false)
  const [hideThinking, setHideThinking] = useState(false);
  const [filterStep, setFilterStep] = useState<number | null>(null);

  const { data: game, isLoading: gameLoading, error: gameError } = useGame(gameId);
  const { data: logs, isLoading: logsLoading, error: logsError } = useGameLogs(gameId);

  const isLoading = gameLoading || logsLoading;
  const error = gameError || logsError;

  // Parse raw logs into display entries
  const parsedEntries = useMemo(() => {
    if (!logs?.agent_logs) return [];
    return parseAgentLogs(logs.agent_logs);
  }, [logs]);

  // Get unique steps for filtering
  const steps = useMemo(() => {
    return [...new Set(parsedEntries.map((e) => e.step))].sort((a, b) => a - b);
  }, [parsedEntries]);

  // Filter entries by step if selected
  const filteredEntries = useMemo(() => {
    return parsedEntries.filter((e) =>
      filterStep === null ? true : e.step === filterStep
    );
  }, [parsedEntries, filterStep]);

  // Extract winner reason from summary if available
  const winnerReason = logs?.summary?.winner_reason as string | undefined;

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
                      .map((p) => {
                        const displayColor = logs?.summary 
                          ? getPlayerColorFromSummary(logs.summary, p.player_number) 
                          : p.player_color;
                        
                        return (
                          <div key={p.player_number} className="flex items-center gap-2">
                            <PlayerBadge
                              name={p.model_name}
                              color={displayColor}
                              role={p.role}
                            />
                            {p.won !== null && (
                              <span className="text-xs">{p.won ? '(Won)' : '(Lost)'}</span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                    Crewmates
                  </h3>
                  <div className="space-y-1">
                    {game.participants
                      .filter((p) => p.role === 'Crewmate')
                      .map((p) => {
                        const displayColor = logs?.summary 
                          ? getPlayerColorFromSummary(logs.summary, p.player_number) 
                          : p.player_color;
                          
                        return (
                          <div key={p.player_number} className="flex items-center gap-2">
                            <PlayerBadge
                              name={p.model_name}
                              color={displayColor}
                              role={p.role}
                            />
                            {p.survived !== null && (
                              <span className="text-xs">
                                {p.survived ? '(Survived)' : '(Eliminated)'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hideThinking}
                  onChange={(e) => setHideThinking(e.target.checked)}
                  className="rounded"
                />
                Hide AI thinking/memory
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

              <span className="text-xs text-gray-400">
                {parsedEntries.length} log entries
              </span>
            </div>

            {/* Chat Log */}
            {parsedEntries.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
                {/* Chat header */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Game Replay</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {filteredEntries.length} messages
                    {filterStep !== null && ` (Step ${filterStep})`}
                  </p>
                </div>

                {/* Messages container */}
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredEntries.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      No log entries for this step
                    </p>
                  ) : (
                    filteredEntries.map((entry, index) => (
                      <ChatBubble
                        key={`${entry.step}-${entry.player_name}-${index}`}
                        entry={entry}
                        hideThinking={hideThinking}
                      />
                    ))
                  )}
                </div>

                {/* Game End Banner - show when viewing all steps and game is completed */}
                {filterStep === null && game.status === 'completed' && game.winner && (
                  <GameEndBanner
                    winner={game.winner}
                    winnerReason={winnerReason || game.winner_reason}
                  />
                )}
              </div>
            )}

            {parsedEntries.length === 0 && !logsLoading && (
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
