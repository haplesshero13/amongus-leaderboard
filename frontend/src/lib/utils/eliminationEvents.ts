import { RawAgentLog, GameSummary, EliminationEvent, PlayerSummary, KillEvent, VoteRound } from '@/types/game';

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
 * 
 * AmongAgents parses responses into objects. An action can be:
 * 1. A top-level string: response.Action = "KILL..."
 * 2. A top-level object: response.Action = { action: "KILL...", thought: "..." }
 * 3. A nested object: response["Thinking Process"].action = "KILL..."
 */
export function getActionFromLog(log: RawAgentLog): string | null {
  const response = log.interaction?.response;

  if (typeof response === 'string') {
    const trimmed = response.trim();
    return trimmed || null;
  }

  if (typeof response === 'object' && response !== null) {
    const responseObj = response as Record<string, unknown>;

    // Helper to extract from a possible action value (string or object)
    const extract = (val: unknown): string | null => {
      if (typeof val === 'string') {
        return val.trim() || null;
      }
      if (typeof val === 'object' && val !== null) {
        const obj = val as Record<string, unknown>;
        if (typeof obj.action === 'string') {
          return obj.action.trim() || null;
        }
      }
      return null;
    };

    // Try multiple possible paths in order of priority

    // 1. Top-level "Action" or "action"
    const topAction = extract(responseObj.Action || responseObj.action);
    if (topAction) return topAction;

    // 2. Nested "Thinking Process".action
    const thinkingProcess = responseObj['Thinking Process'];
    const nestedAction = extract(thinkingProcess);
    if (nestedAction) return nestedAction;

    // 3. Last resort: if responseObj ITSELF has an 'action' field (happens in some formats)
    if (typeof responseObj.action === 'string') {
      return responseObj.action.trim() || null;
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

  // Helper to get player info from summary or logs
  // (We'll re-implement this inside the summary block if needed, or keep it scoped)
  // But first, let's try to use the robust summary data if available
  if (summary && 'kill_history' in summary && 'voting_history' in summary) {
    const killHistory = summary.kill_history as KillEvent[];
    const votingHistory = summary.voting_history as VoteRound[];

    // Helper to get player info from summary
    const getPlayerFromSummary = (playerNum: number) => {
      const playerData = summary[`Player ${playerNum}`];
      if (isPlayerSummary(playerData)) {
        return {
          color: playerData.color,
          role: playerData.identity,
          name: playerData.name
        };
      }
      return { color: 'gray', role: 'Unknown', name: `Player ${playerNum}` };
    };

    // 1. Process Kill History
    if (Array.isArray(killHistory)) {
      for (const kill of killHistory) {
        const victimNum = getPlayerNumber(kill.victim);
        const killerNum = getPlayerNumber(kill.killer);

        if (victimNum !== null) {
          const { color, role } = getPlayerFromSummary(victimNum);

          events.push({
            step: kill.timestep,
            type: 'killed',
            victimPlayerNumber: victimNum,
            victimColor: color,
            victimRole: role,
            killerPlayerNumber: killerNum ?? undefined,
            killerColor: killerNum ? getPlayerFromSummary(killerNum).color : undefined,
            location: kill.location
          });
          eliminatedPlayers.add(victimNum);
        }
      }
    }

    // 2. Process Voting History
    if (Array.isArray(votingHistory)) {
      for (const round of votingHistory) {
        // Only process if someone was eliminated
        if (round.eliminated) {
          const victimNum = getPlayerNumber(round.eliminated);

          if (victimNum !== null) {
            const { color, role } = getPlayerFromSummary(victimNum);

            // Reconstruct votes map
            const votes: Record<string, string> = {};
            if (Array.isArray(round.votes)) {
              for (const vote of round.votes) {
                const voterNum = getPlayerNumber(vote.voter);
                const targetNum = getPlayerNumber(vote.target);

                if (voterNum !== null && targetNum !== null) {
                  const voterName = getPlayerFromSummary(voterNum).name;
                  const targetName = `Player ${targetNum}`; // Standardize target format
                  votes[voterName] = targetName;
                }
              }
            }

            events.push({
              step: round.timestep,
              type: 'ejected',
              victimPlayerNumber: victimNum,
              victimColor: color,
              victimRole: role,
              votes: votes
            });
            eliminatedPlayers.add(victimNum);
          }
        }
      }
    }

    // Sort events by step
    events.sort((a, b) => a.step - b.step);

    // If we successfully reasoned about events from summary, return them.
    // We check if we found anything OR if the game is completed (indicated by summary presence usually).
    // But to be safe, if we found events, we return. 
    // If the arrays were empty but game is done, it's also valid (nobody died).
    return events;
  }

  // --- FALLBACK: Manual Log Parsing (for running games or legacy logs) ---

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

      // DEBUG: Log kill detection attempts with more detail
      if (action.toUpperCase().includes('KILL')) {
        console.log('[EliminationEvents] Potential kill detected:', {
          step,
          action,
          victimNum,
          playerIdentity: log.player?.identity,
          isImpostorCheck: log.player?.identity?.toLowerCase() === 'impostor',
          alreadyEliminated: victimNum ? eliminatedPlayers.has(victimNum) : 'N/A',
        });
      }

      // Check if player is impostor (case-insensitive) and valid victim
      const isImpostor = log.player?.identity?.toLowerCase() === 'impostor';

      if (victimNum && isImpostor && !eliminatedPlayers.has(victimNum)) {
        console.log('[EliminationEvents] ✓ Kill event added for victim', victimNum);
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
