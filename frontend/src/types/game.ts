export interface GameParticipant {
  model_id: string;
  model_name: string;
  player_number: number;
  player_color: string;
  role: string;
  won: boolean | null;
  survived: boolean | null;
}

export interface Game {
  game_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  ended_at: string | null;
  winner: number | null;
  winner_reason: string | null;
  participants: GameParticipant[];
  log_url: string | null;
  error_message: string | null;
}

// Raw log entry from the backend (directly from amongagents)
export interface RawAgentLog {
  game_index?: string;
  step: number;
  timestamp: string;
  player: {
    name: string;
    identity: string; // "Crewmate" or "Impostor"
    personality: string | null;
    model: string;
    location: string;
  };
  interaction: {
    system_prompt?: string;
    prompt?: {
      Summarization?: string;
      "All Info"?: string;
      Memory?: string;
      Phase?: string;
    };
    response: {
      "Condensed Memory"?: string;
      "Thinking Process"?: string | { thought?: string; action?: string };
      Action?: string;
      action?: string;
    } | string;
    full_response?: string;
  };
}

// Parsed log entry for display
export interface GameLogEntry {
  step: number;
  timestamp: string;
  player_name: string;
  player_color: string;
  player_role: string;
  model: string;
  location: string;
  action: string;
  thinking: string | null;
  memory: string | null;
  // Full raw data for optional expansion
  raw_prompt?: string;
  full_response?: string;
}

export interface GameConfig {
  num_players: number;
  num_impostors: number;
  num_common_tasks: number;
  num_short_tasks: number;
  num_long_tasks: number;
  discussion_rounds: number;
  max_num_buttons: number;
  kill_cooldown: number;
  max_timesteps: number;
}

export interface PlayerSummary {
  name: string;
  color: string;
  identity: string;
  model: string;
  personality: string | null;
  tasks: string[];
}

export interface GameSummary {
  config: GameConfig;
  winner: number;
  winner_reason: string;
  // Dynamic keys like "Player 1", "Player 2"
  [key: string]: GameConfig | number | string | PlayerSummary;
}

export interface GameLogsResponse {
  game_id: string;
  agent_logs: RawAgentLog[];
  summary: GameSummary | null;
}

export const WINNER_LABELS: Record<number, string> = {
  1: 'Impostors Win (Outnumbered Crew)',
  2: 'Crewmates Win (Eliminated Impostors)',
  3: 'Crewmates Win (Tasks Completed)',
  4: 'Impostors Win (Time Limit)',
};

export const PLAYER_COLORS: Record<string, string> = {
  red: '#C51111',
  blue: '#132ED2',
  green: '#117F2D',
  pink: '#ED53B9',
  orange: '#EF7D0E',
  yellow: '#F5F558',
  brown: '#6B3E10',
  cyan: '#38FEDB',
  lime: '#50EF39',
  purple: '#6B2FBB',
  white: '#D6E0F0',
  gray: '#758694',
};
