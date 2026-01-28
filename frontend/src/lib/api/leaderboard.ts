import { LeaderboardResponse } from '../../types/leaderboard';
import { getMockLeaderboard } from './mock-data';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchLeaderboard(
  page: number = 1,
  perPage: number = 20
): Promise<LeaderboardResponse> {
  // Use mock data when no API URL is configured
  if (!API_BASE_URL) {
    // Simulate network delay for realistic UX
    await new Promise((resolve) => setTimeout(resolve, 300));
    return getMockLeaderboard(page, perPage);
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
