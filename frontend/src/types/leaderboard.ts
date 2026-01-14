export interface ModelRanking {
  model_id: string;
  model_name: string;
  provider: string;
  overall_rating: number;
  impostor_rating: number;
  crewmate_rating: number;
  games_played: number;
  current_rank: number;
  previous_rank: number;
  rank_change: number;
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

export type SortField = 'overall_rating' | 'impostor_rating' | 'crewmate_rating' | 'games_played';
export type SortDirection = 'asc' | 'desc';
