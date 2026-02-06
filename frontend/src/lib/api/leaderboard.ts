import { LeaderboardResponse, Season } from '../../types/leaderboard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchLeaderboard(
  page: number = 1,
  perPage: number = 20,
  engineVersion?: number | null
): Promise<LeaderboardResponse> {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }

  let url = `${API_BASE_URL}/api/leaderboard?page=${page}&per_page=${perPage}`;
  if (engineVersion != null) {
    url += `&engine_version=${engineVersion}`;
  }

  const response = await fetch(url, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchSeasons(): Promise<Season[]> {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }

  const response = await fetch(`${API_BASE_URL}/api/seasons`, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch seasons: ${response.statusText}`);
  }

  return response.json();
}
