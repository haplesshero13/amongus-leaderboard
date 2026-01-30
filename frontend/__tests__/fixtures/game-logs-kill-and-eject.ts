/**
 * Test fixture: Game with kills and an ejection
 *
 * Scenario:
 * - Step 5: Player 3 (Impostor) kills Player 1 (Crewmate)
 * - Step 10: Players vote and eject Player 3 (Impostor)
 */
import { RawAgentLog, GameSummary } from '@/types/game';

export const killAndEjectLogs: RawAgentLog[] = [
  // Step 1: Normal gameplay
  {
    step: 1,
    timestamp: '2026-01-29T10:00:00Z',
    player: {
      name: 'Player 1: brown',
      identity: 'Crewmate',
      personality: null,
      model: 'gpt-5-mini',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'MOVE to Electrical' },
      full_response: '[Thinking Process] I should do my tasks.\n[Action] MOVE to Electrical',
    },
  },
  {
    step: 1,
    timestamp: '2026-01-29T10:00:01Z',
    player: {
      name: 'Player 2: cyan',
      identity: 'Crewmate',
      personality: null,
      model: 'claude-haiku-4.5',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'MOVE to Medbay' },
      full_response: '[Thinking Process] Going to medbay for scan.\n[Action] MOVE to Medbay',
    },
  },
  {
    step: 1,
    timestamp: '2026-01-29T10:00:02Z',
    player: {
      name: 'Player 3: red',
      identity: 'Impostor',
      personality: null,
      model: 'gemini-3-flash',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'MOVE to Electrical' },
      full_response: '[Thinking Process] Following brown to eliminate.\n[Action] MOVE to Electrical',
    },
  },

  // Step 5: Kill happens
  {
    step: 5,
    timestamp: '2026-01-29T10:05:00Z',
    player: {
      name: 'Player 3: red',
      identity: 'Impostor',
      personality: null,
      model: 'gemini-3-flash',
      location: 'Electrical',
    },
    interaction: {
      response: { Action: 'KILL Player 1' },
      full_response:
        '[Thinking Process] Brown is alone with me. Perfect time to strike.\n[Action] KILL Player 1: brown',
    },
  },

  // Step 10: Voting round - ejection
  {
    step: 10,
    timestamp: '2026-01-29T10:10:00Z',
    player: {
      name: 'Player 2: cyan',
      identity: 'Crewmate',
      personality: null,
      model: 'claude-haiku-4.5',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'VOTE Player 3' },
      full_response:
        '[Thinking Process] Red was near electrical when brown died.\n[Action] VOTE Player 3',
    },
  },
  {
    step: 10,
    timestamp: '2026-01-29T10:10:01Z',
    player: {
      name: 'Player 4: lime',
      identity: 'Crewmate',
      personality: null,
      model: 'llama-3.3-70b',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'VOTE Player 3' },
      full_response: '[Thinking Process] I agree with cyan.\n[Action] VOTE Player 3',
    },
  },
  {
    step: 10,
    timestamp: '2026-01-29T10:10:02Z',
    player: {
      name: 'Player 5: purple',
      identity: 'Crewmate',
      personality: null,
      model: 'deepseek-r1',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'VOTE Player 3' },
      full_response: '[Thinking Process] Red is suspicious.\n[Action] VOTE Player 3',
    },
  },
  {
    step: 10,
    timestamp: '2026-01-29T10:10:03Z',
    player: {
      name: 'Player 3: red',
      identity: 'Impostor',
      personality: null,
      model: 'gemini-3-flash',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'VOTE Player 2' },
      full_response:
        "[Thinking Process] I need to deflect blame.\n[Action] VOTE Player 2",
    },
  },
];

export const killAndEjectSummary: GameSummary = {
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
  winner: 2,
  winner_reason: 'All impostors have been eliminated',
  'Player 1': {
    name: 'Player 1: brown',
    color: 'brown',
    identity: 'Crewmate',
    model: 'gpt-5-mini',
    personality: null,
    tasks: ['Fix Wiring', 'Empty Garbage'],
  },
  'Player 2': {
    name: 'Player 2: cyan',
    color: 'cyan',
    identity: 'Crewmate',
    model: 'claude-haiku-4.5',
    personality: null,
    tasks: ['Submit Scan', 'Swipe Card'],
  },
  'Player 3': {
    name: 'Player 3: red',
    color: 'red',
    identity: 'Impostor',
    model: 'gemini-3-flash',
    personality: null,
    tasks: [],
  },
  'Player 4': {
    name: 'Player 4: lime',
    color: 'lime',
    identity: 'Crewmate',
    model: 'llama-3.3-70b',
    personality: null,
    tasks: ['Download Data', 'Upload Data'],
  },
  'Player 5': {
    name: 'Player 5: purple',
    color: 'purple',
    identity: 'Crewmate',
    model: 'deepseek-r1',
    personality: null,
    tasks: ['Calibrate Distributor'],
  },
};

// Expected elimination events
export const expectedEvents = [
  {
    step: 5,
    type: 'killed',
    victimPlayerNumber: 1,
    victimColor: 'brown',
    victimRole: 'Crewmate',
    killerPlayerNumber: 3,
    location: 'Electrical',
  },
  {
    step: 10,
    type: 'ejected',
    victimPlayerNumber: 3,
    victimColor: 'red',
    victimRole: 'Impostor',
  },
];
