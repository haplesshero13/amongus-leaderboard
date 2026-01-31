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
 * Extract the Action field from a log entry's response.
 * Returns the trimmed action string, or null if not found/empty.
 */
export function getActionFromLog(log: RawAgentLog): string | null {
  const response = log.interaction?.response;

  if (typeof response === 'string') {
    const trimmed = response.trim();
    return trimmed || null;
  }

  if (typeof response === 'object' && response !== null) {
    const responseObj = response as Record<string, unknown>;
    // Check both "Action" and "action" (case sensitivity)
    const action = responseObj.Action || responseObj.action;
    if (typeof action === 'string') {
      const trimmed = action.trim();
      return trimmed || null;
    }
  }

  return null;
}

/**
 * Parse a KILL action string. Returns victim player number or null.
 * Action must start with "KILL Player N" to match.
 */
export function parseKillAction(action: string): number | null {
  if (!action.toUpperCase().startsWith('KILL ')) {
    return null;
  }
  const match = action.match(/^KILL\s+Player\s*(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Parse a VOTE action string. Returns target player number or null.
 * Action must start with "VOTE Player N" to match.
 */
export function parseVoteAction(action: string): number | null {
  if (!action.toUpperCase().startsWith('VOTE ')) {
    return null;
  }
  const match = action.match(/^VOTE\s+Player\s*(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Extract player number from a player name like "Player 3: red"
 */
export function getPlayerNumber(playerName: string): number | null {
  const match = playerName.match(/Player\s*(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Extract elimination events from raw game logs.
 * 
 * The action must START with the action type (KILL or VOTE) to be detected.
 * 
 * Known formats:
 * - "KILL Player N" or "KILL Player N: color"
 * - "VOTE Player N" or "VOTE Player N: color"
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

  const sortedSteps = [...logsByStep.keys()].sort((a, b) => a - b);

  // First pass: find KILL actions
  for (const step of sortedSteps) {
    for (const log of logsByStep.get(step)!) {
      const action = getActionFromLog(log);
      if (!action) continue;

      const victimNum = parseKillAction(action);
      if (victimNum && log.player?.identity === 'Impostor' && !eliminatedPlayers.has(victimNum)) {
        eliminatedPlayers.add(victimNum);
        const { color, role } = getPlayerInfo(victimNum);
        const killerNum = getPlayerNumber(log.player?.name || '');

        events.push({
          step,
          type: 'killed',
          victimPlayerNumber: victimNum,
          victimColor: color,
          victimRole: role,
          killerPlayerNumber: killerNum ?? undefined,
          location: log.player?.location || 'Unknown',
        });
      }
    }
  }

  // Second pass: find ejections from votes
  for (const step of sortedSteps) {
    const votes: Record<string, string> = {};
    const voteCounts: Record<string, number> = {};

    for (const log of logsByStep.get(step)!) {
      const action = getActionFromLog(log);
      if (!action) continue;

      const targetNum = parseVoteAction(action);
      if (targetNum) {
        const voterName = log.player?.name || 'Unknown';
        const targetKey = `Player ${targetNum}`;
        votes[voterName] = targetKey;
        voteCounts[targetKey] = (voteCounts[targetKey] || 0) + 1;
      }
    }

    // Determine if someone was ejected (majority vote, no tie)
    if (Object.keys(voteCounts).length > 0) {
      const sortedVotes = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
      const [topVote, secondVote] = sortedVotes;

      if (!secondVote || topVote[1] > secondVote[1]) {
        const ejectedNum = getPlayerNumber(topVote[0]);

        if (ejectedNum && !eliminatedPlayers.has(ejectedNum)) {
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
