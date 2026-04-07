'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Markdown from 'react-markdown';
import { Virtuoso } from 'react-virtuoso';
import posthog from 'posthog-js';
import { useGame, useGameLogs } from '@/lib/hooks/useGames';
import { useGameStream } from '@/lib/hooks/useGameStream';
import { PageLayout } from '@/components/layout/PageLayout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { GameLogEntry, RawAgentLog, TurnLogEntry, WINNER_LABELS, PLAYER_COLORS, GameSummary, PlayerSummary, EliminationEvent, DisplayItem } from '@/types/game';
import { extractEliminationEvents } from '@/lib/utils/eliminationEvents';

/**
 * Parse raw agent logs into display-friendly entries
 */
function parseAgentLogs(rawLogs: RawAgentLog[], summary?: GameSummary | null): GameLogEntry[] {
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

    // Extract player number from name for summary lookup
    // "Player 1: brown" -> "1"
    const playerNumMatch = playerName.match(/Player (\d+)/);
    const playerNumber = playerNumMatch ? parseInt(playerNumMatch[1]) : null;

    // Determine model name: try summary first (source of truth), then log
    let modelName = player.model || 'Unknown';

    if (summary && playerNumber !== null) {
      const summaryPlayer = summary[`Player ${playerNumber}`];
      if (isPlayerSummary(summaryPlayer)) {
        modelName = summaryPlayer.model;
      }
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
      model: modelName,
      location: player.location || 'Unknown',
      action,
      thinking,
      memory,
      raw_prompt: rawPrompt || undefined,
      full_response: interaction.full_response || undefined,
    };
  });
}

/**
 * Build timeline from turn_log (primary) enriched with agent_logs (AI thinking data).
 * Falls back to parseAgentLogs when turn_log is absent (older games, streaming).
 */
function parseGameTimeline(
  turnLog: TurnLogEntry[],
  agentLogs: RawAgentLog[],
  summary?: GameSummary | null,
): GameLogEntry[] {
  // Build a lookup from agent_logs keyed by (step, playerNumber)
  const agentLogMap = new Map<string, RawAgentLog>();
  for (const log of agentLogs) {
    const playerName = log.player?.name || '';
    const playerNumMatch = playerName.match(/Player (\d+)/);
    if (playerNumMatch) {
      const key = `${log.step}-${playerNumMatch[1]}`;
      // Only keep first occurrence per (step, player) to avoid overwrites
      if (!agentLogMap.has(key)) {
        agentLogMap.set(key, log);
      }
    }
  }

  return turnLog.map((entry) => {
    // Parse "Player N: color" format
    const playerStr = entry.player || '';
    const playerNumMatch = playerStr.match(/Player (\d+)/);
    const playerNumber = playerNumMatch ? parseInt(playerNumMatch[1]) : null;

    let playerColor = 'gray';
    if (playerStr.includes(':')) {
      playerColor = playerStr.split(':')[1].trim();
    }

    // Look up model and identity from summary
    let modelName = 'Human';
    let playerRole = 'Unknown';
    if (summary && playerNumber !== null) {
      const summaryPlayer = summary[`Player ${playerNumber}`];
      if (isPlayerSummary(summaryPlayer)) {
        modelName = summaryPlayer.model;
        playerRole = summaryPlayer.identity;
      }
    }

    // Try to enrich with agent_log data (thinking, memory, timestamp)
    let thinking: string | null = null;
    let memory: string | null = null;
    let timestamp = '';
    let location = 'Unknown';
    let rawPrompt: string | undefined;
    let fullResponse: string | undefined;

    if (playerNumber !== null) {
      const agentLog = agentLogMap.get(`${entry.timestep}-${playerNumber}`);
      if (agentLog) {
        timestamp = agentLog.timestamp || '';
        location = agentLog.player?.location || 'Unknown';
        const response = agentLog.interaction?.response;
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
          const memoryVal = response['Condensed Memory'];
          if (typeof memoryVal === 'string') {
            memory = memoryVal;
          } else if (memoryVal) {
            memory = JSON.stringify(memoryVal);
          }
        }
        const prompt = agentLog.interaction?.prompt;
        rawPrompt = prompt?.['All Info'] || undefined;
        fullResponse = agentLog.interaction?.full_response || undefined;
        // Override model from agent_log if summary not available
        if (agentLog.player?.model && modelName === 'Human') {
          modelName = agentLog.player.model;
        }
        // Override identity from agent_log if summary not available
        if (agentLog.player?.identity && playerRole === 'Unknown') {
          playerRole = agentLog.player.identity;
        }
      }
    }

    // Ensure action is always a string
    const action = typeof entry.action === 'string' ? entry.action : String(entry.action || '');

    return {
      step: entry.timestep,
      timestamp,
      player_name: playerStr,
      player_color: playerColor,
      player_role: playerRole,
      model: modelName,
      location,
      action,
      thinking,
      memory,
      phase: entry.phase || undefined,
      raw_prompt: rawPrompt,
      full_response: fullResponse,
    };
  });
}

function PlayerBadge({ name, color, role, playerNumber }: { name: string; color: string; role: string; playerNumber: number }) {
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
      <span className="text-xs text-gray-500 dark:text-gray-400">
        (P{playerNumber} &bull; {color})
      </span>
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
    // Split by slash and take the second part if available
    const parts = model.split('/');
    if (parts.length > 1) {
      return parts[1];
    }
    return model;
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
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${isImpostor
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
    <div className={`mt-6 rounded-lg border-2 p-6 text-center ${isImpostorWin
        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
        : 'border-green-500 bg-green-50 dark:bg-green-900/20'
      }`}>
      <div className="text-2xl font-bold mb-2">
        GAME END
      </div>
      <div className={`text-lg font-semibold ${isImpostorWin ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
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

/**
 * Dramatic interstitial card showing an elimination event
 */
function EliminationCard({ event }: { event: EliminationEvent }) {
  const bgColor = PLAYER_COLORS[event.victimColor.toLowerCase()] || '#808080';
  const isImpostor = event.victimRole === 'Impostor';
  const isEjection = event.type === 'ejected';

  return (
    <div className="my-4 mx-2">
      <div
        className={`relative overflow-hidden rounded-xl border-2 ${isEjection
            ? 'border-purple-500 bg-gradient-to-r from-purple-900/90 to-indigo-900/90'
            : 'border-red-600 bg-gradient-to-r from-red-900/90 to-rose-900/90'
          } shadow-lg`}
      >
        {/* Animated background effect */}
        <div className="absolute inset-0 opacity-20">
          <div className={`absolute inset-0 ${isEjection ? 'bg-purple-500' : 'bg-red-500'} animate-pulse`} />
        </div>

        {/* Content */}
        <div className="relative p-6 text-center">
          {/* Icon */}
          <div className="mb-3">
            {isEjection ? (
              <span className="text-4xl">🚀</span>
            ) : (
              <span className="text-4xl">💀</span>
            )}
          </div>

          {/* Event type header */}
          <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${isEjection ? 'text-purple-300' : 'text-red-300'
            }`}>
            Step {event.step}
          </div>

          {/* Main text */}
          <div className="text-2xl font-black text-white mb-2 tracking-wide">
            {isEjection ? (
              <>
                <span
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-lg"
                  style={{ backgroundColor: bgColor }}
                >
                  <span className="uppercase">{event.victimColor}</span>
                </span>
                <span className="mx-2">WAS EJECTED</span>
              </>
            ) : (
              <>
                <span
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-lg"
                  style={{ backgroundColor: bgColor }}
                >
                  <span className="uppercase">{event.victimColor}</span>
                </span>
                <span className="mx-2">WAS KILLED</span>
              </>
            )}
          </div>

          {/* Player details */}
          <div className="text-lg text-white/90 mb-3">
            Player {event.victimPlayerNumber} • {' '}
            <span className={isImpostor ? 'text-red-400 font-bold' : 'text-blue-400'}>
              {event.victimRole}
            </span>
          </div>

          {/* Impostor reveal for ejections */}
          {isEjection && (
            <div className={`text-sm font-medium ${isImpostor
                ? 'text-red-400'
                : 'text-green-400'
              }`}>
              {isImpostor
                ? '🔪 They were an Impostor!'
                : '✨ They were not an Impostor.'}
            </div>
          )}

          {/* Killer identity for kills */}
          {!isEjection && event.killerPlayerNumber != null && event.killerColor && (
            <div className="text-sm text-white/70 mb-1">
              Killed by{' '}
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-lg text-white text-xs font-semibold"
                style={{ backgroundColor: PLAYER_COLORS[event.killerColor.toLowerCase()] || '#808080' }}
              >
                {event.killerColor.toUpperCase()}
              </span>
              {' '}Player {event.killerPlayerNumber}
            </div>
          )}

          {/* Location for kills */}
          {!isEjection && event.location && (
            <div className="text-sm text-white/70">
              📍 Location: {event.location}
            </div>
          )}

          {/* Vote breakdown for ejections */}
          {isEjection && event.votes && Object.keys(event.votes).length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="text-xs text-white/60 uppercase tracking-wider mb-2">
                Vote Results
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {Object.entries(event.votes).map(([voter, target]) => {
                  const voterNum = voter.match(/Player (\d+)/)?.[1] || '?';
                  const targetNum = target.match(/Player (\d+)/)?.[1] || '?';
                  const votedForVictim = target === `Player ${event.victimPlayerNumber}`;

                  return (
                    <span
                      key={voter}
                      className={`text-xs px-2 py-1 rounded ${votedForVictim
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-white/60'
                        }`}
                    >
                      P{voterNum} → P{targetNum}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Step marker showing when a new game step begins
 */
function StepMarker({ step, phase }: { step: number; phase: string }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 my-2">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Step {step}
        </span>
        {phase && (
          <>
            <span className="text-gray-400">•</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {phase}
            </span>
          </>
        )}
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
    </div>
  );
}

function isPlayerSummary(data: unknown): data is PlayerSummary {
  return (
    typeof data === 'object' &&
    data !== null &&
    'color' in data &&
    typeof (data as Record<string, unknown>).color === 'string'
  );
}

function hasName(data: unknown): data is { name: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    typeof (data as Record<string, unknown>).name === 'string'
  );
}

// Helper to extract color from summary or logs
function getPlayerColorFromSummary(
  summary: GameSummary | null | undefined, 
  playerNumber: number,
  logs?: RawAgentLog[]
): string {
  // Try summary first
  if (summary) {
    const playerKey = `Player ${playerNumber}`;
    const playerData = summary[playerKey];

    // Runtime check to distinguish PlayerSummary from GameConfig/number/string
    if (isPlayerSummary(playerData)) {
      return playerData.color;
    }

    // Try parsing name if color field missing
    if (hasName(playerData)) {
      const name = playerData.name;
      if (name.includes(':')) {
        const parts = name.split(':');
        if (parts.length > 1) return parts[1].trim();
      }
    }
  }

  // Fall back to extracting from logs if summary not available (e.g., running games)
  if (logs) {
    for (const log of logs) {
      const playerName = log.player?.name || '';
      const match = playerName.match(/Player (\d+):\s*(\w+)/);
      if (match && parseInt(match[1]) === playerNumber) {
        return match[2];
      }
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
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);

  const handleThinkingToggle = (newValue: boolean) => {
    posthog.capture('thinking_visibility_toggled', {
      game_id: gameId,
      hide_thinking: newValue,
      action: newValue ? 'hidden' : 'shown',
    });
    setHideThinking(newValue);
  };

  const handleStepFilterChange = (newStep: number | null) => {
    posthog.capture('game_step_filter_changed', {
      game_id: gameId,
      from_step: filterStep,
      to_step: newStep,
    });
    setFilterStep(newStep);
  };

  const { data: game, isLoading: gameLoading, error: gameError, refetch: refetchGame } = useGame(gameId);
  const { data: logs, isLoading: logsLoading, error: logsError } = useGameLogs(gameId);

  // Use streaming for running games
  const isRunningGame = game?.status === 'running' || game?.status === 'pending';
  const { logs: streamLogs, summary: streamSummary, status: streamStatus } = useGameStream(gameId, isRunningGame);

  // Poll for game status updates when game is running
  useEffect(() => {
    if (!isRunningGame) return;

    const interval = setInterval(() => {
      refetchGame();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [isRunningGame, refetchGame]);

  // Determine which logs to use: streaming or static
  const effectiveLogs = isRunningGame && streamLogs.length > 0 ? streamLogs : logs?.agent_logs;
  const effectiveSummary = isRunningGame && streamSummary ? streamSummary : logs?.summary;

  // Track initial load completion
  useEffect(() => {
    if ((game || gameError) && !hasLoadedInitially) {
      setHasLoadedInitially(true);
    }
  }, [game, gameError, hasLoadedInitially]);

  // Only show loading spinner on the FIRST load, not on subsequent refetches for streaming games
  const isInitialLoading = !hasLoadedInitially && (gameLoading || (logsLoading && !isRunningGame));
  const error = gameError || (!isRunningGame && logsError);

  // Parse raw logs into display entries.
  // When a completed game has turn_log in the summary, use it as the primary timeline
  // so human player turns are included. Fall back to agent_logs for older games and
  // for live streaming (where no summary is available yet).
  const parsedEntries = useMemo(() => {
    const turnLog = effectiveSummary?.turn_log;
    if (turnLog && turnLog.length > 0 && effectiveLogs) {
      return parseGameTimeline(turnLog, effectiveLogs, effectiveSummary);
    }
    if (!effectiveLogs) return [];
    return parseAgentLogs(effectiveLogs, effectiveSummary);
  }, [effectiveLogs, effectiveSummary]);

  // Extract elimination events
  const eliminationEvents = useMemo(() => {
    if (!effectiveLogs) return [];
    return extractEliminationEvents(effectiveLogs, effectiveSummary);
  }, [effectiveLogs, effectiveSummary]);

  // Get unique steps for filtering
  const steps = useMemo(() => {
    return [...new Set(parsedEntries.map((e) => e.step))].sort((a, b) => a - b);
  }, [parsedEntries]);

  // Combine log entries with elimination events into display items
  const displayItems = useMemo((): DisplayItem[] => {
    const items: DisplayItem[] = [];
    let lastStep = -1;

    // Filter entries by step if selected
    const entriesToShow = parsedEntries.filter((e) =>
      filterStep === null ? true : e.step === filterStep
    );

    // Filter elimination events by step if selected
    const eventsToShow = eliminationEvents.filter((e) =>
      filterStep === null ? true : e.step === filterStep
    );

    // Track which steps have had eliminations inserted
    const eliminationsInserted = new Set<number>();

    for (const entry of entriesToShow) {
      // Add step marker if step changed
      if (entry.step !== lastStep) {
        // Before showing new step, show any eliminations from the previous step
        if (lastStep >= 0 && !eliminationsInserted.has(lastStep)) {
          const prevStepEliminations = eventsToShow.filter(e => e.step === lastStep);
          for (const event of prevStepEliminations) {
            items.push({ type: 'elimination', event });
          }
          eliminationsInserted.add(lastStep);
        }

        // Determine phase: prefer explicit phase from turn_log, else infer from action
        let phase = entry.phase || '';
        if (!phase) {
          if (entry.action?.includes('SPEAK')) {
            phase = 'Meeting';
          } else if (entry.action?.includes('VOTE')) {
            phase = 'Voting';
          } else if (entry.action?.includes('MOVE') || entry.action?.includes('TASK') || entry.action?.includes('KILL')) {
            phase = 'Task';
          }
        }

        items.push({ type: 'step-marker', step: entry.step, phase });
        lastStep = entry.step;
      }

      items.push({ type: 'log', entry });
    }

    // Add any remaining eliminations after the last step
    if (lastStep >= 0 && !eliminationsInserted.has(lastStep)) {
      const lastStepEliminations = eventsToShow.filter(e => e.step === lastStep);
      for (const event of lastStepEliminations) {
        items.push({ type: 'elimination', event });
      }
      eliminationsInserted.add(lastStep);
    }

    // Also add elimination events that might be at a step not in the logs
    for (const event of eventsToShow) {
      if (!eliminationsInserted.has(event.step)) {
        // Find the right position to insert
        let insertIdx = items.length;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type === 'step-marker' && item.step > event.step) {
            insertIdx = i;
            break;
          }
        }
        items.splice(insertIdx, 0, { type: 'elimination', event });
        eliminationsInserted.add(event.step);
      }
    }

    return items;
  }, [parsedEntries, eliminationEvents, filterStep]);

  // Pre-calculate the set of eliminated players at each index of the list
  const [topVisibleIndex, setTopVisibleIndex] = useState(0);

  const deadPlayersTimeline = useMemo(() => {
    const timeline: Set<number>[] = [];
    const currentDead = new Set<number>();

    for (const item of displayItems) {
      // Snapshot state BEFORE this item is fully processed
      timeline.push(new Set(currentDead));

      if (item.type === 'elimination') {
        currentDead.add(item.event.victimPlayerNumber);
      }
    }
    // Add one more for the end state
    timeline.push(new Set(currentDead));

    return timeline;
  }, [displayItems]);

  const currentAliveParticipants = useMemo(() => {
    if (!game?.participants) return [];

    // Safety check for index
    // Add a small offset so the state updates as soon as the event hits the top of the screen (or just before)
    // We want the "past" log to reflect the state *after* the events we've scrolled past.
    // Virtuoso's startIndex is the first rendered item. With top buffer, this might be off-screen.
    // Adjusted to +2 to make it feel reactive.
    const index = Math.min(topVisibleIndex + 2, deadPlayersTimeline.length - 1);
    const deadSet = deadPlayersTimeline[index] || new Set();

    return game.participants
      .filter(p => !deadSet.has(p.player_number))
      .sort((a, b) => a.player_number - b.player_number);
  }, [game?.participants, deadPlayersTimeline, topVisibleIndex]);

  // Filter entries by step if selected (legacy - now handled in displayItems)
  const filteredEntries = useMemo(() => {
    return parsedEntries.filter((e) =>
      filterStep === null ? true : e.step === filterStep
    );
  }, [parsedEntries, filterStep]);

  // Extract winner reason from summary if available
  const winnerReason = effectiveSummary?.winner_reason as string | undefined;

  // Show live indicator when streaming
  const isLive = isRunningGame && streamStatus === 'connected';

  return (
    <PageLayout activePage="/games" maxWidth="4xl" showFooter={false}>
      {/* Game Log title + LIVE badge */}
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Game Log
        </h2>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            LIVE
          </span>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
          {gameId}
        </p>
      </div>

        {isInitialLoading && <LoadingSpinner />}

        {error && (
          <ErrorMessage
            error={error}
            onRetry={() => window.location.reload()}
          />
        )}

        {!isInitialLoading && !error && game && (
          <>
            {/* Game Summary */}
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${game.status === 'completed'
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
                        const displayColor = getPlayerColorFromSummary(
                          effectiveSummary,
                          p.player_number,
                          effectiveLogs
                        ) || p.player_color;

                        // Check if this player was eliminated
                        const eliminationEvent = eliminationEvents.find(
                          e => e.victimPlayerNumber === p.player_number
                        );
                        const isEliminated = !!eliminationEvent;
                        const eliminationEmoji = eliminationEvent?.type === 'ejected' ? '🚀' : eliminationEvent?.type === 'killed' ? '💀' : '';

                        return (
                          <div key={p.player_number} className={`flex items-center gap-2 ${isEliminated ? 'opacity-60' : ''}`}>
                            <div className={isEliminated ? 'line-through decoration-2' : ''}>
                              <PlayerBadge
                                name={p.model_name}
                                color={displayColor}
                                role={p.role}
                                playerNumber={p.player_number}
                              />
                            </div>
                            {isEliminated ? (
                              <span className="text-sm" title={`${eliminationEvent?.type} at step ${eliminationEvent?.step}`}>
                                {eliminationEmoji}
                              </span>
                            ) : p.won !== null ? (
                              <span className="text-xs">{p.won ? '(Won)' : '(Lost)'}</span>
                            ) : null}
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
                        const displayColor = getPlayerColorFromSummary(
                          effectiveSummary,
                          p.player_number,
                          effectiveLogs
                        ) || p.player_color;

                        // Check if this player was eliminated
                        const eliminationEvent = eliminationEvents.find(
                          e => e.victimPlayerNumber === p.player_number
                        );
                        const isEliminated = !!eliminationEvent;
                        const eliminationEmoji = eliminationEvent?.type === 'ejected' ? '🚀' : eliminationEvent?.type === 'killed' ? '💀' : '';

                        return (
                          <div key={p.player_number} className={`flex items-center gap-2 ${isEliminated ? 'opacity-60' : ''}`}>
                            <div className={isEliminated ? 'line-through decoration-2' : ''}>
                              <PlayerBadge
                                name={p.model_name}
                                color={displayColor}
                                role={p.role}
                                playerNumber={p.player_number}
                              />
                            </div>
                            {isEliminated ? (
                              <span className="text-sm" title={`${eliminationEvent?.type} at step ${eliminationEvent?.step}`}>
                                {eliminationEmoji}
                              </span>
                            ) : p.survived !== null ? (
                              <span className="text-xs">
                                {p.survived ? '(Survived)' : '(Eliminated)'}
                              </span>
                            ) : null}
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
                  onChange={(e) => handleThinkingToggle(e.target.checked)}
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
                      handleStepFilterChange(e.target.value ? parseInt(e.target.value) : null)
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
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Game Replay</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {filteredEntries.length} messages, {eliminationEvents.length} eliminations
                      {filterStep !== null && ` (Step ${filterStep})`}
                    </p>
                  </div>

                  {/* Alive Players Indicator */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Alive:</span>
                    <div className="flex items-center gap-1">
                      {currentAliveParticipants.map(p => {
                        const displayColor = getPlayerColorFromSummary(
                          effectiveSummary,
                          p.player_number,
                          effectiveLogs
                        ) || p.player_color;
                        const bgColor = PLAYER_COLORS[displayColor.toLowerCase()] || '#808080';

                        return (
                          <div
                            key={p.player_number}
                            className="group relative"
                          >
                            <div
                              className="h-3 w-3 rounded-full shadow-sm ring-1 ring-black/10 transition-transform hover:scale-125"
                              style={{ backgroundColor: bgColor }}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 z-50 mb-2 hidden w-max -translate-x-1/2 group-hover:block px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap pointer-events-none">
                              P{p.player_number} • {p.model_name}
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <span className="ml-1 text-xs text-gray-400">({currentAliveParticipants.length})</span>
                  </div>
                </div>

                {/* Messages container - virtualized for performance */}
                {displayItems.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    No log entries for this step
                  </p>
                ) : (
                  <div className="h-[600px] overflow-hidden">
                    <Virtuoso
                      data={displayItems}
                      increaseViewportBy={{ top: 0, bottom: 200 }}
                      rangeChanged={(range) => {
                        setTopVisibleIndex(range.startIndex);
                      }}
                      itemContent={(index, item) => {
                        if (item.type === 'elimination') {
                          return <EliminationCard key={`elim-${item.event.step}-${item.event.victimPlayerNumber}`} event={item.event} />;
                        }
                        if (item.type === 'step-marker') {
                          return <StepMarker key={`step-${item.step}`} step={item.step} phase={item.phase} />;
                        }
                        // item.type === 'log'
                        return (
                          <div className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                            <ChatBubble
                              key={`${item.entry.step}-${item.entry.player_name}-${index}`}
                              entry={item.entry}
                              hideThinking={hideThinking}
                            />
                          </div>
                        );
                      }}
                      components={{
                        Footer: () => (
                          filterStep === null && game.status === 'completed' && game.winner ? (
                            <GameEndBanner
                              winner={game.winner}
                              winnerReason={winnerReason || game.winner_reason}
                            />
                          ) : null
                        ),
                      }}
                    />
                  </div>
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
    </PageLayout>
  );
}
