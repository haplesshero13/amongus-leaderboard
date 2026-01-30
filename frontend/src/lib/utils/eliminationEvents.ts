import { RawAgentLog, GameSummary, EliminationEvent, PlayerSummary } from '@/types/game';

/**
 * Type guard to check if a value is a PlayerSummary
 */
function isPlayerSummary(data: unknown): data is PlayerSummary {
  return (
    typeof data === 'object' &&
    data !== null &&
    'color' in data &&
    typeof (data as Record<string, unknown>).color === 'string'
  );
}

/**
 * Extract elimination events from raw game logs.
 *
 * Looks for:
 * 1. KILL actions in full_response -> killed event
 * 2. VOTE actions to determine ejections
 *
 * Known formats for KILL actions:
 * - "[Action] KILL Player N"
 * - "[Action] KILL Player N: color"
 * - "KILL Player N"
 *
 * Known formats for VOTE actions:
 * - "[Action] VOTE Player N"
 * - "VOTE Player N"
 */
export function extractEliminationEvents(
  rawLogs: RawAgentLog[],
  summary?: GameSummary | null
): EliminationEvent[] {
  const events: EliminationEvent[] = [];
  const eliminatedPlayers = new Set<number>();

  // Group logs by step
  const logsByStep = new Map<number, RawAgentLog[]>();
  for (const log of rawLogs) {
    const step = log.step ?? 0;
    if (!logsByStep.has(step)) {
      logsByStep.set(step, []);
    }
    logsByStep.get(step)!.push(log);
  }

  // Build a map of player number -> color from logs themselves
  const playerColorMap = new Map<number, string>();
  for (const log of rawLogs) {
    const playerName = log.player?.name || '';
    const match = playerName.match(/Player (\d+):\s*(\w+)/);
    if (match) {
      const num = parseInt(match[1]);
      const color = match[2];
      if (!playerColorMap.has(num)) {
        playerColorMap.set(num, color);
      }
    }
  }

  // Helper to get player info from summary or logs
  const getPlayerInfo = (playerNum: number) => {
    let color = playerColorMap.get(playerNum) || 'gray';
    let role = 'Unknown';
    if (summary) {
      const playerData = summary[`Player ${playerNum}`];
      if (isPlayerSummary(playerData)) {
        color = playerData.color;
        role = playerData.identity;
      }
    }
    return { color, role };
  };

  // Process each step
  const sortedSteps = [...logsByStep.keys()].sort((a, b) => a - b);

  // First pass: find KILL actions directly
  for (const step of sortedSteps) {
    const stepLogs = logsByStep.get(step)!;

    for (const log of stepLogs) {
      const fullResponse = log.interaction?.full_response || '';

      // Also check the response.Action field directly
      const responseAction =
        typeof log.interaction?.response === 'object'
          ? (log.interaction.response as Record<string, unknown>).Action ||
            (log.interaction.response as Record<string, unknown>).action
          : typeof log.interaction?.response === 'string'
            ? log.interaction.response
            : '';
      const actionStr = typeof responseAction === 'string' ? responseAction : '';

      // Combine both sources to check for KILL
      const textToSearch = `${fullResponse}\n${actionStr}`;

      // Look for KILL actions in multiple formats:
      // 1. "[Action] KILL Player N: color" or "[Action] KILL Player N"
      // 2. Just "KILL Player N" (without [Action] prefix)
      const killPatterns = [
        /\[Action\]\s*KILL\s+Player\s*(\d+)/i,
        /\bKILL\s+Player\s*(\d+)/i,
      ];

      for (const pattern of killPatterns) {
        const killMatch = textToSearch.match(pattern);
        if (killMatch && log.player?.identity === 'Impostor') {
          const victimNum = parseInt(killMatch[1]);
          if (victimNum > 0 && !eliminatedPlayers.has(victimNum)) {
            eliminatedPlayers.add(victimNum);
            const { color, role } = getPlayerInfo(victimNum);
            const killerNum = log.player?.name?.match(/Player (\d+)/)?.[1];

            events.push({
              step,
              type: 'killed',
              victimPlayerNumber: victimNum,
              victimColor: color,
              victimRole: role,
              killerPlayerNumber: killerNum ? parseInt(killerNum) : undefined,
              location: log.player?.location || 'Unknown',
            });
            break; // Found a match, don't process other patterns
          }
        }
      }
    }
  }

  // Second pass: find ejections from votes
  for (const step of sortedSteps) {
    const stepLogs = logsByStep.get(step)!;

    // Collect votes from this step
    const votes: Record<string, string> = {};
    const voteCounts: Record<string, number> = {};

    for (const log of stepLogs) {
      const fullResponse = log.interaction?.full_response || '';
      const playerName = log.player?.name || 'Unknown';

      // Also check the response.Action field directly
      const responseAction =
        typeof log.interaction?.response === 'object'
          ? (log.interaction.response as Record<string, unknown>).Action ||
            (log.interaction.response as Record<string, unknown>).action
          : typeof log.interaction?.response === 'string'
            ? log.interaction.response
            : '';
      const actionStr = typeof responseAction === 'string' ? responseAction : '';

      // Combine both sources to check for VOTE
      const textToSearch = `${fullResponse}\n${actionStr}`;

      // Look for VOTE actions in multiple formats:
      // 1. "[Action] VOTE Player N"
      // 2. Just "VOTE Player N"
      const votePatterns = [
        /\[Action\]\s*VOTE\s+Player\s*(\d+)/i,
        /\bVOTE\s+Player\s*(\d+)/i,
      ];

      for (const pattern of votePatterns) {
        const voteMatch = textToSearch.match(pattern);
        if (voteMatch) {
          const targetNum = parseInt(voteMatch[1]);
          const targetKey = `Player ${targetNum}`;
          votes[playerName] = targetKey;
          voteCounts[targetKey] = (voteCounts[targetKey] || 0) + 1;
          break; // Found a match, don't process other patterns
        }
      }
    }

    // Determine if someone was ejected (vote majority)
    if (Object.keys(voteCounts).length > 0) {
      const sortedVotes = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
      const topVote = sortedVotes[0];
      const secondVote = sortedVotes[1];

      // Check if there's a clear winner (not a tie)
      if (!secondVote || topVote[1] > secondVote[1]) {
        const ejectedKey = topVote[0];
        const ejectedNum = parseInt(ejectedKey.match(/Player (\d+)/)?.[1] || '0');

        if (ejectedNum > 0 && !eliminatedPlayers.has(ejectedNum)) {
          eliminatedPlayers.add(ejectedNum);
          const { color, role } = getPlayerInfo(ejectedNum);

          events.push({
            step,
            type: 'ejected',
            victimPlayerNumber: ejectedNum,
            victimColor: color,
            victimRole: role,
            votes,
          });
        }
      }
    }
  }

  // Sort events by step
  events.sort((a, b) => a.step - b.step);

  return events;
}

/**
 * Get the count of eliminated players at or before a given step
 */
export function getEliminatedPlayersAtStep(
  events: EliminationEvent[],
  step: number
): Set<number> {
  const eliminated = new Set<number>();
  for (const event of events) {
    if (event.step <= step) {
      eliminated.add(event.victimPlayerNumber);
    }
  }
  return eliminated;
}
