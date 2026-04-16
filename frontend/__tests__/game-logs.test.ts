import { describe, it, expect } from 'vitest';

// Test the parseAgentLogs logic by importing and testing directly
// Since it's not exported, we'll test via the types and expected behavior

import { GameLogEntry, RawAgentLog, GameSummary, TurnLogEntry } from '@/types/game';

// Replicate the parseAgentLogs function for testing
// (In a real refactor, we'd extract this to a separate module)
function parseAgentLogs(rawLogs: RawAgentLog[], summary?: GameSummary | null): GameLogEntry[] {
  return rawLogs.map((log) => {
    const player = log.player || ({} as RawAgentLog['player']);
    const interaction = log.interaction || ({} as RawAgentLog['interaction']);
    const response = interaction.response;

    const playerName = player.name || 'Unknown';
    let playerColor = 'gray';
    if (playerName.includes(':')) {
      playerColor = playerName.split(':')[1].trim();
    }

    const playerNumMatch = playerName.match(/Player (\d+)/);
    const playerNumber = playerNumMatch ? parseInt(playerNumMatch[1]) : null;

    let modelName = player.model || 'Unknown';

    if (summary && playerNumber !== null) {
      const summaryPlayer = summary[`Player ${playerNumber}`];
      if (summaryPlayer && typeof summaryPlayer === 'object' && 'model' in summaryPlayer) {
        modelName = (summaryPlayer as { model: string }).model;
      }
    }

    let action = '';
    if (typeof response === 'string') {
      action = response;
    } else if (response && typeof response === 'object') {
      const topLevelAction = response.Action || response.action;
      if (typeof topLevelAction === 'string') {
        action = topLevelAction;
      }
    }

    let thinking: string | null = null;
    if (response && typeof response === 'object') {
      const thinkingVal = response['Thinking Process'];
      if (typeof thinkingVal === 'string') {
        thinking = thinkingVal;
      } else if (thinkingVal && typeof thinkingVal === 'object' && 'thought' in thinkingVal) {
        thinking = thinkingVal.thought || null;
      }
    }

    let memory: string | null = null;
    if (response && typeof response === 'object') {
      const memoryVal = response['Condensed Memory'];
      if (typeof memoryVal === 'string') {
        memory = memoryVal;
      }
    }

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
      raw_prompt: interaction.prompt?.['All Info'] || undefined,
      full_response: interaction.full_response || undefined,
    };
  });
}

function parseGameTimeline(
  turnLog: TurnLogEntry[],
  agentLogs: RawAgentLog[],
  summary?: GameSummary | null,
): GameLogEntry[] {
  const agentLogMap = new Map<string, RawAgentLog>();
  for (const log of agentLogs) {
    const playerName = log.player?.name || '';
    const playerNumMatch = playerName.match(/Player (\d+)/);
    if (playerNumMatch) {
      const key = `${log.step}-${playerNumMatch[1]}`;
      if (!agentLogMap.has(key)) {
        agentLogMap.set(key, log);
      }
    }
  }

  return turnLog
    .filter((entry) => /Player\s+\d+/i.test(entry.player || ''))
    .map((entry) => {
      const playerStr = entry.player || '';
      const playerNumMatch = playerStr.match(/Player (\d+)/);
      const playerNumber = playerNumMatch ? parseInt(playerNumMatch[1]) : null;

      let playerColor = 'gray';
      if (playerStr.includes(':')) {
        playerColor = playerStr.split(':')[1].trim();
      }

      let modelName = 'Human';
      let playerRole = 'Unknown';
      if (summary && playerNumber !== null) {
        const summaryPlayer = summary[`Player ${playerNumber}`];
        if (summaryPlayer && typeof summaryPlayer === 'object' && 'model' in summaryPlayer && 'identity' in summaryPlayer) {
          modelName = (summaryPlayer as { model: string }).model;
          playerRole = (summaryPlayer as { identity: string }).identity;
        }
      }

      let timestamp = '';
      let location = 'Unknown';
      let thinking: string | null = null;
      let memory: string | null = null;

      if (playerNumber !== null) {
        const agentLog = agentLogMap.get(`${entry.timestep}-${playerNumber}`);
        if (agentLog) {
          timestamp = agentLog.timestamp || '';
          location = agentLog.player?.location || 'Unknown';
          const response = agentLog.interaction?.response;
          if (response && typeof response === 'object') {
            const thinkingVal = response['Thinking Process'];
            if (typeof thinkingVal === 'string') {
              thinking = thinkingVal;
            } else if (thinkingVal && typeof thinkingVal === 'object' && 'thought' in thinkingVal) {
              thinking = thinkingVal.thought || null;
            }

            const memoryVal = response['Condensed Memory'];
            if (typeof memoryVal === 'string') {
              memory = memoryVal;
            }
          }
        }
      }

      return {
        step: entry.timestep,
        timestamp,
        player_name: playerStr,
        player_color: playerColor,
        player_role: playerRole,
        model: modelName,
        location,
        action: typeof entry.action === 'string' ? entry.action : String(entry.action || ''),
        thinking,
        memory,
        phase: entry.phase || undefined,
      };
    });
}

describe('parseAgentLogs', () => {
  it('extracts player color from name', () => {
    const rawLogs: RawAgentLog[] = [
      {
        step: 1,
        timestamp: '2026-01-29T12:00:00Z',
        player: {
          name: 'Player 1: brown',
          identity: 'Crewmate',
          personality: null,
          model: 'gpt-5',
          location: 'Cafeteria',
        },
        interaction: {
          response: { Action: 'MOVE to Medbay' },
        },
      },
    ];

    const result = parseAgentLogs(rawLogs);
    expect(result[0].player_color).toBe('brown');
    expect(result[0].player_name).toBe('Player 1: brown');
  });

  it('extracts action from response object', () => {
    const rawLogs: RawAgentLog[] = [
      {
        step: 2,
        timestamp: '2026-01-29T12:01:00Z',
        player: {
          name: 'Player 3: lime',
          identity: 'Impostor',
          personality: null,
          model: 'claude-4',
          location: 'Electrical',
        },
        interaction: {
          response: { Action: 'KILL Player 1' },
        },
      },
    ];

    const result = parseAgentLogs(rawLogs);
    expect(result[0].action).toBe('KILL Player 1');
    expect(result[0].player_role).toBe('Impostor');
  });

  it('handles string response', () => {
    const rawLogs: RawAgentLog[] = [
      {
        step: 1,
        timestamp: '',
        player: {
          name: 'Player 2: yellow',
          identity: 'Crewmate',
          personality: null,
          model: 'gemini-3',
          location: 'Admin',
        },
        interaction: {
          response: 'SPEAK: I saw brown vent!',
        },
      },
    ];

    const result = parseAgentLogs(rawLogs);
    expect(result[0].action).toBe('SPEAK: I saw brown vent!');
  });

  it('extracts thinking process as string', () => {
    const rawLogs: RawAgentLog[] = [
      {
        step: 1,
        timestamp: '',
        player: {
          name: 'Player 4: purple',
          identity: 'Crewmate',
          personality: null,
          model: 'llama-4',
          location: 'Storage',
        },
        interaction: {
          response: {
            'Thinking Process': 'I need to complete my tasks quickly.',
            Action: 'DO_TASK Fix Wiring',
          },
        },
      },
    ];

    const result = parseAgentLogs(rawLogs);
    expect(result[0].thinking).toBe('I need to complete my tasks quickly.');
  });

  it('extracts condensed memory', () => {
    const rawLogs: RawAgentLog[] = [
      {
        step: 5,
        timestamp: '',
        player: {
          name: 'Player 1: red',
          identity: 'Impostor',
          personality: null,
          model: 'gpt-5',
          location: 'Weapons',
        },
        interaction: {
          response: {
            'Condensed Memory': 'Killed blue in electrical. Must act innocent.',
            Action: 'MOVE to Cafeteria',
          },
        },
      },
    ];

    const result = parseAgentLogs(rawLogs);
    expect(result[0].memory).toBe('Killed blue in electrical. Must act innocent.');
  });

  it('uses summary model name over log model name', () => {
    const rawLogs: RawAgentLog[] = [
      {
        step: 1,
        timestamp: '',
        player: {
          name: 'Player 2: green',
          identity: 'Crewmate',
          personality: null,
          model: 'old-model-name',
          location: 'Reactor',
        },
        interaction: {
          response: { Action: 'DO_TASK' },
        },
      },
    ];

    const summary: GameSummary = {
      config: { num_players: 7, num_impostors: 2 } as GameSummary['config'],
      winner: 2,
      winner_reason: 'Crewmates win!',
      'Player 2': {
        name: 'Player 2: green',
        color: 'green',
        identity: 'Crewmate',
        model: 'correct-model-name',
        personality: null,
        tasks: [],
      },
    };

    const result = parseAgentLogs(rawLogs, summary);
    expect(result[0].model).toBe('correct-model-name');
  });

  it('handles empty logs array', () => {
    const result = parseAgentLogs([]);
    expect(result).toEqual([]);
  });

  it('defaults missing fields gracefully', () => {
    const rawLogs: RawAgentLog[] = [
      {
        step: 0,
        timestamp: '',
        player: {} as RawAgentLog['player'],
        interaction: {} as RawAgentLog['interaction'],
      },
    ];

    const result = parseAgentLogs(rawLogs);
    expect(result[0].player_name).toBe('Unknown');
    expect(result[0].player_color).toBe('gray');
    expect(result[0].player_role).toBe('Unknown');
    expect(result[0].model).toBe('Unknown');
    expect(result[0].location).toBe('Unknown');
    expect(result[0].action).toBe('');
  });
});

describe('Game Log Types', () => {
  it('GameLogEntry has all required fields', () => {
    const entry: GameLogEntry = {
      step: 1,
      timestamp: '2026-01-29T12:00:00Z',
      player_name: 'Player 1: brown',
      player_color: 'brown',
      player_role: 'Crewmate',
      model: 'gpt-5',
      location: 'Cafeteria',
      action: 'MOVE to Medbay',
      thinking: 'I should go to medbay',
      memory: 'Started in cafeteria',
    };

    expect(entry.step).toBe(1);
    expect(entry.player_color).toBe('brown');
    expect(entry.player_role).toBe('Crewmate');
  });
});

describe('parseGameTimeline', () => {
  it('skips system voting summary entries that do not belong to a player', () => {
    const turnLog: TurnLogEntry[] = [
      {
        timestep: 6,
        phase: 'meeting',
        player: 'Player 2: brown',
        action: 'VOTE Player 6: red',
      },
      {
        timestep: 6,
        phase: 'voting_results',
        player: 'None',
        action: 'VOTE_SUMMARY',
      },
    ];

    const agentLogs: RawAgentLog[] = [
      {
        step: 6,
        timestamp: '2026-04-16T16:35:46Z',
        player: {
          name: 'Player 2: brown',
          identity: 'Crewmate',
          personality: null,
          model: 'glm-5.1',
          location: 'Cafeteria',
        },
        interaction: {
          response: { Action: 'VOTE Player 6: red' },
        },
      },
    ];

    const summary: GameSummary = {
      config: { num_players: 7, num_impostors: 2 } as GameSummary['config'],
      winner: 2,
      winner_reason: 'Crewmates win!',
      'Player 2': {
        name: 'Player 2: brown',
        color: 'brown',
        identity: 'Crewmate',
        model: 'glm-5.1',
        personality: null,
        tasks: [],
      },
    };

    const result = parseGameTimeline(turnLog, agentLogs, summary);

    expect(result).toHaveLength(1);
    expect(result[0].player_name).toBe('Player 2: brown');
    expect(result[0].action).toBe('VOTE Player 6: red');
  });
});
