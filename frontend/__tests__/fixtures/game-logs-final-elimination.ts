/**
 * Test fixture: Game ending with a final elimination
 *
 * Scenario:
 * - Step 15: Last crewmate is killed, impostors win
 *
 * This tests the case where the final elimination might not be detected
 * because the game ends immediately after.
 */
import { RawAgentLog, GameSummary } from '@/types/game';

export const finalEliminationLogs: RawAgentLog[] = [
  // Step 10: First kill
  {
    step: 10,
    timestamp: '2026-01-29T10:10:00Z',
    player: {
      name: 'Player 1: red',
      identity: 'Impostor',
      personality: null,
      model: 'gpt-5-mini',
      location: 'Electrical',
    },
    interaction: {
      response: { Action: 'KILL Player 4' },
      full_response: '[Thinking Process] Blue is alone.\n[Action] KILL Player 4',
    },
  },

  // Step 12: Second kill
  {
    step: 12,
    timestamp: '2026-01-29T10:12:00Z',
    player: {
      name: 'Player 2: pink',
      identity: 'Impostor',
      personality: null,
      model: 'claude-haiku-4.5',
      location: 'Storage',
    },
    interaction: {
      response: { Action: 'KILL Player 5' },
      full_response: '[Thinking Process] Time to strike.\n[Action] KILL Player 5: green',
    },
  },

  // Step 15: Final kill - game ends
  // This is the potentially problematic case: the final elimination
  {
    step: 15,
    timestamp: '2026-01-29T10:15:00Z',
    player: {
      name: 'Player 1: red',
      identity: 'Impostor',
      personality: null,
      model: 'gpt-5-mini',
      location: 'Reactor',
    },
    interaction: {
      response: { Action: 'KILL Player 6' },
      // Different format: "KILL Player N" without [Action] prefix
      full_response: 'Thinking: This will end the game.\nKILL Player 6',
    },
  },
];

export const finalEliminationSummary: GameSummary = {
  config: {
    num_players: 7,
    num_impostors: 2,
    num_common_tasks: 2,
    num_short_tasks: 3,
    num_long_tasks: 1,
    discussion_rounds: 3,
    max_num_buttons: 2,
    kill_cooldown: 30,
    max_timesteps: 100,
  },
  winner: 1, // Impostors win
  winner_reason: 'Impostors have outnumbered the crew',
  'Player 1': {
    name: 'Player 1: red',
    color: 'red',
    identity: 'Impostor',
    model: 'gpt-5-mini',
    personality: null,
    tasks: [],
  },
  'Player 2': {
    name: 'Player 2: pink',
    color: 'pink',
    identity: 'Impostor',
    model: 'claude-haiku-4.5',
    personality: null,
    tasks: [],
  },
  'Player 3': {
    name: 'Player 3: cyan',
    color: 'cyan',
    identity: 'Crewmate',
    model: 'gemini-3-flash',
    personality: null,
    tasks: ['Fix Wiring'],
  },
  'Player 4': {
    name: 'Player 4: blue',
    color: 'blue',
    identity: 'Crewmate',
    model: 'llama-3.3-70b',
    personality: null,
    tasks: ['Download Data'],
  },
  'Player 5': {
    name: 'Player 5: green',
    color: 'green',
    identity: 'Crewmate',
    model: 'deepseek-r1',
    personality: null,
    tasks: ['Swipe Card'],
  },
  'Player 6': {
    name: 'Player 6: yellow',
    color: 'yellow',
    identity: 'Crewmate',
    model: 'qwen3-235b',
    personality: null,
    tasks: ['Upload Data'],
  },
  'Player 7': {
    name: 'Player 7: white',
    color: 'white',
    identity: 'Crewmate',
    model: 'minimax-m2',
    personality: null,
    tasks: ['Empty Garbage'],
  },
};

// Expected elimination events - including the final one!
export const expectedEvents = [
  {
    step: 10,
    type: 'killed',
    victimPlayerNumber: 4,
    victimColor: 'blue',
    victimRole: 'Crewmate',
    killerPlayerNumber: 1,
    location: 'Electrical',
  },
  {
    step: 12,
    type: 'killed',
    victimPlayerNumber: 5,
    victimColor: 'green',
    victimRole: 'Crewmate',
    killerPlayerNumber: 2,
    location: 'Storage',
  },
  {
    step: 15,
    type: 'killed',
    victimPlayerNumber: 6,
    victimColor: 'yellow',
    victimRole: 'Crewmate',
    killerPlayerNumber: 1,
    location: 'Reactor',
  },
];
