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
}

export interface GameLogsResponse {
  game_id: string;
  entries: GameLogEntry[];
  summary: Record<string, unknown> | null;
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
