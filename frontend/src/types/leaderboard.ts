export interface ModelRanking {
  model_id: string;
  model_name: string;
  provider: string;
  overall_rating: number;
  impostor_rating: number;
  crewmate_rating: number;
  // Uncertainty values (sigma) - calculate conservative as rating - sigma
  overall_sigma: number;
  impostor_sigma: number;
  crewmate_sigma: number;
  games_played: number;
  current_rank: number;
  // Win/loss stats
  impostor_games: number;
  impostor_wins: number;
  crewmate_games: number;
  crewmate_wins: number;
  win_rate: number;  // Overall win rate percentage (0-100)
  impostor_win_rate: number;  // Impostor win rate percentage (0-100)
  crewmate_win_rate: number;  // Crewmate win rate percentage (0-100)
  release_date: string;
  avatar_color: string;
}

export interface LeaderboardResponse {
  data: ModelRanking[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface Season {
  version: number;
  label: string;
  game_count: number;
}

export type SortField = 'overall_rating' | 'impostor_rating' | 'crewmate_rating' | 'games_played';
export type SortDirection = 'asc' | 'desc';

/**
 * Calculate conservative rating (68% confidence floor).
 * This is the skill level we're 68% confident the model has at minimum.
 */
export function getConservativeRating(rating: number, sigma: number): number {
  return Math.round(rating - sigma);
}
