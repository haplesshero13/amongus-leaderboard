import { LeaderboardResponse } from '../../types/leaderboard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchLeaderboard(
  page: number = 1,
  perPage: number = 20
): Promise<LeaderboardResponse> {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/leaderboard?page=${page}&per_page=${perPage}`,
    {
      next: { revalidate: 60 }, // Cache for 60 seconds
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
  }

  return response.json();
}
