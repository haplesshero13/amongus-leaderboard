/**
 * Test fixture: Edge cases for elimination detection
 *
 * Scenarios:
 * - Vote tie (no ejection should occur)
 * - Alternative action formats
 * - No full_response field
 */
import { RawAgentLog, GameSummary } from '@/types/game';

// Scenario 1: Vote tie - no ejection should happen
export const voteTieLogs: RawAgentLog[] = [
  {
    step: 10,
    timestamp: '2026-01-29T10:10:00Z',
    player: {
      name: 'Player 1: red',
      identity: 'Crewmate',
      personality: null,
      model: 'gpt-5-mini',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'VOTE Player 2' },
      full_response: '[Action] VOTE Player 2',
    },
  },
  {
    step: 10,
    timestamp: '2026-01-29T10:10:01Z',
    player: {
      name: 'Player 2: blue',
      identity: 'Impostor',
      personality: null,
      model: 'claude-haiku-4.5',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'VOTE Player 1' },
      full_response: '[Action] VOTE Player 1',
    },
  },
  {
    step: 10,
    timestamp: '2026-01-29T10:10:02Z',
    player: {
      name: 'Player 3: green',
      identity: 'Crewmate',
      personality: null,
      model: 'gemini-3-flash',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'VOTE Player 2' },
      full_response: '[Action] VOTE Player 2',
    },
  },
  {
    step: 10,
    timestamp: '2026-01-29T10:10:03Z',
    player: {
      name: 'Player 4: yellow',
      identity: 'Crewmate',
      personality: null,
      model: 'llama-3.3-70b',
      location: 'Cafeteria',
    },
    interaction: {
      response: { Action: 'VOTE Player 1' },
      full_response: '[Action] VOTE Player 1',
    },
  },
];

// Scenario 2: Alternative kill format without brackets
export const alternativeFormatLogs: RawAgentLog[] = [
  {
    step: 5,
    timestamp: '2026-01-29T10:05:00Z',
    player: {
      name: 'Player 2: pink',
      identity: 'Impostor',
      personality: null,
      model: 'claude-haiku-4.5',
      location: 'Medbay',
    },
    interaction: {
      response: 'KILL Player 3',
      // Response is just a string, not an object
      full_response: 'I need to eliminate them quickly. KILL Player 3',
    },
  },
];

// Scenario 3: Missing full_response but action in response object
export const noFullResponseLogs: RawAgentLog[] = [
  {
    step: 7,
    timestamp: '2026-01-29T10:07:00Z',
    player: {
      name: 'Player 1: red',
      identity: 'Impostor',
      personality: null,
      model: 'gpt-5-mini',
      location: 'Electrical',
    },
    interaction: {
      response: { Action: 'KILL Player 5' },
      // No full_response - should still detect from response.Action
    },
  },
];

// Summary for all scenarios
export const edgeCaseSummary: GameSummary = {
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
  winner: 1,
  winner_reason: 'Impostors win',
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
    name: 'Player 3: green',
    color: 'green',
    identity: 'Crewmate',
    model: 'gemini-3-flash',
    personality: null,
    tasks: ['Fix Wiring'],
  },
  'Player 4': {
    name: 'Player 4: yellow',
    color: 'yellow',
    identity: 'Crewmate',
    model: 'llama-3.3-70b',
    personality: null,
    tasks: ['Download Data'],
  },
  'Player 5': {
    name: 'Player 5: cyan',
    color: 'cyan',
    identity: 'Crewmate',
    model: 'deepseek-r1',
    personality: null,
    tasks: ['Swipe Card'],
  },
};

// Expected events for vote tie: none (tie means no ejection)
export const expectedVoteTieEvents: { type: string; victimPlayerNumber: number }[] = [];

// Expected events for alternative format
export const expectedAlternativeFormatEvents = [
  {
    step: 5,
    type: 'killed',
    victimPlayerNumber: 3,
    victimColor: 'green',
    victimRole: 'Crewmate',
    killerPlayerNumber: 2,
    location: 'Medbay',
  },
];
