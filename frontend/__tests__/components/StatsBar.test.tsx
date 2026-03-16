import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock the hooks before importing the component
vi.mock('@/lib/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}));

vi.mock('@/lib/hooks/useSeasons', () => ({
  useSeasons: vi.fn(),
}));

vi.mock('@/lib/api/leaderboard', () => ({
  fetchSeasons: vi.fn(),
  fetchLeaderboard: vi.fn(),
}));

import { useRankings } from '@/lib/hooks/useRankings';
import { useSeasons } from '@/lib/hooks/useSeasons';

// Import the page component after mocking
import LeaderboardPage from '@/app/leaderboard/page';

describe('StatsBar games count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays exact count of completed games from season data', async () => {
    // Mock useSeasons to return season with game_count of 5
    vi.mocked(useSeasons).mockReturnValue({
      seasons: [
        { version: 1, label: 'Season 1 — Long Context', game_count: 5 },
      ],
      selectedSeason: 1,
      selectedSeasonLabel: 'Season 1 — Long Context',
      selectedSeasonGameCount: 5,
      isLoading: false,
      setSelectedSeason: vi.fn(),
    });

    // Mock 3 models with varying games_played (totaling way more than 5)
    const mockRankings = {
      data: [
        { model_id: 'm1', model_name: 'Model 1', provider: 'Test', avatar_color: '#FF0000', impostor_rating: 2600, crewmate_rating: 2400, overall_rating: 2500, overall_sigma: 200, impostor_sigma: 250, crewmate_sigma: 180, games_played: 10, current_rank: 1, impostor_games: 5, impostor_wins: 3, crewmate_games: 5, crewmate_wins: 2, win_rate: 50, impostor_win_rate: 60, crewmate_win_rate: 40, release_date: '2025-01-01' },
        { model_id: 'm2', model_name: 'Model 2', provider: 'Test', avatar_color: '#00FF00', impostor_rating: 2500, crewmate_rating: 2550, overall_rating: 2525, overall_sigma: 210, impostor_sigma: 260, crewmate_sigma: 190, games_played: 8, current_rank: 2, impostor_games: 4, impostor_wins: 2, crewmate_games: 4, crewmate_wins: 2, win_rate: 50, impostor_win_rate: 50, crewmate_win_rate: 50, release_date: '2025-01-01' },
        { model_id: 'm3', model_name: 'Model 3', provider: 'Test', avatar_color: '#0000FF', impostor_rating: 2400, crewmate_rating: 2300, overall_rating: 2350, overall_sigma: 230, impostor_sigma: 280, crewmate_sigma: 200, games_played: 7, current_rank: 3, impostor_games: 3, impostor_wins: 1, crewmate_games: 4, crewmate_wins: 1, win_rate: 28.6, impostor_win_rate: 33.3, crewmate_win_rate: 25, release_date: '2025-01-01' },
      ],
      total: 3,
      page: 1,
      per_page: 100,
      total_pages: 1,
    };

    vi.mocked(useRankings).mockReturnValue({
      data: mockRankings,
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    render(<LeaderboardPage />);

    // The "Games Played" stat should show 5 (season game_count)
    // NOT 25 (sum of games_played across models: 10+8+7=25)
    await waitFor(() => {
      const gamesPlayedCard = screen.getByText(/Games Played/).closest('div')?.parentElement;
      expect(gamesPlayedCard).toBeDefined();

      // Find the number in the card
      const numberElement = gamesPlayedCard?.querySelector('.text-2xl');
      expect(numberElement?.textContent).toBe('5');
    });
  });

  it('displays 0 games when no completed games exist', async () => {
    vi.mocked(useSeasons).mockReturnValue({
      seasons: [
        { version: 1, label: 'Season 1 — Long Context', game_count: 0 },
      ],
      selectedSeason: 1,
      selectedSeasonLabel: 'Season 1 — Long Context',
      selectedSeasonGameCount: 0,
      isLoading: false,
      setSelectedSeason: vi.fn(),
    });

    vi.mocked(useRankings).mockReturnValue({
      data: { data: [], total: 0, page: 1, per_page: 100, total_pages: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    render(<LeaderboardPage />);

    await waitFor(() => {
      const gamesPlayedCard = screen.getByText(/Games Played/).closest('div')?.parentElement;
      const numberElement = gamesPlayedCard?.querySelector('.text-2xl');
      expect(numberElement?.textContent).toBe('0');
    });
  });

  it('displays top impostor model name', async () => {
    vi.mocked(useSeasons).mockReturnValue({
      seasons: [
        { version: 1, label: 'Season 1 — Long Context', game_count: 10 },
      ],
      selectedSeason: 1,
      selectedSeasonLabel: 'Season 1 — Long Context',
      selectedSeasonGameCount: 10,
      isLoading: false,
      setSelectedSeason: vi.fn(),
    });

    const mockRankings = {
      data: [
        { model_id: 'm1', model_name: 'GPT-5', provider: 'OpenAI', avatar_color: '#10A37F', impostor_rating: 2800, crewmate_rating: 2400, overall_rating: 2600, overall_sigma: 200, impostor_sigma: 220, crewmate_sigma: 240, games_played: 10, current_rank: 1, impostor_games: 5, impostor_wins: 4, crewmate_games: 5, crewmate_wins: 2, win_rate: 60, impostor_win_rate: 80, crewmate_win_rate: 40, release_date: '2025-01-01' },
        { model_id: 'm2', model_name: 'Claude 4', provider: 'Anthropic', avatar_color: '#D97706', impostor_rating: 2600, crewmate_rating: 2700, overall_rating: 2650, overall_sigma: 210, impostor_sigma: 230, crewmate_sigma: 190, games_played: 8, current_rank: 2, impostor_games: 4, impostor_wins: 2, crewmate_games: 4, crewmate_wins: 3, win_rate: 62.5, impostor_win_rate: 50, crewmate_win_rate: 75, release_date: '2025-01-01' },
      ],
      total: 2,
      page: 1,
      per_page: 100,
      total_pages: 1,
    };

    vi.mocked(useRankings).mockReturnValue({
      data: mockRankings,
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    render(<LeaderboardPage />);

    // GPT-5 has highest impostor rating (2800) - appears in stats bar AND leaderboard
    await waitFor(() => {
      const matches = screen.getAllByText('GPT-5');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      // First one should be in the stats bar with red color
      expect(matches[0].className).toContain('text-[#F21717]');
    });
  });

  it('displays top crewmate model name', async () => {
    vi.mocked(useSeasons).mockReturnValue({
      seasons: [
        { version: 1, label: 'Season 1 — Long Context', game_count: 10 },
      ],
      selectedSeason: 1,
      selectedSeasonLabel: 'Season 1 — Long Context',
      selectedSeasonGameCount: 10,
      isLoading: false,
      setSelectedSeason: vi.fn(),
    });

    const mockRankings = {
      data: [
        { model_id: 'm1', model_name: 'GPT-5', provider: 'OpenAI', avatar_color: '#10A37F', impostor_rating: 2800, crewmate_rating: 2400, overall_rating: 2600, overall_sigma: 200, impostor_sigma: 220, crewmate_sigma: 240, games_played: 10, current_rank: 1, impostor_games: 5, impostor_wins: 4, crewmate_games: 5, crewmate_wins: 2, win_rate: 60, impostor_win_rate: 80, crewmate_win_rate: 40, release_date: '2025-01-01' },
        { model_id: 'm2', model_name: 'Claude 4', provider: 'Anthropic', avatar_color: '#D97706', impostor_rating: 2600, crewmate_rating: 2700, overall_rating: 2650, overall_sigma: 210, impostor_sigma: 230, crewmate_sigma: 190, games_played: 8, current_rank: 2, impostor_games: 4, impostor_wins: 2, crewmate_games: 4, crewmate_wins: 3, win_rate: 62.5, impostor_win_rate: 50, crewmate_win_rate: 75, release_date: '2025-01-01' },
      ],
      total: 2,
      page: 1,
      per_page: 100,
      total_pages: 1,
    };

    vi.mocked(useRankings).mockReturnValue({
      data: mockRankings,
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    render(<LeaderboardPage />);

    // Claude 4 has highest crewmate rating (2700) - appears in stats bar AND leaderboard
    await waitFor(() => {
      const matches = screen.getAllByText('Claude 4');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      // First one should be in the stats bar with the crewmate palette color
      expect(matches[0].className).toContain('text-[#235685]');
    });
  });

  it('displays season suffix in stat labels', async () => {
    vi.mocked(useSeasons).mockReturnValue({
      seasons: [
        { version: 1, label: 'Season 1 — Long Context', game_count: 42 },
        { version: 0, label: 'Season 0 — Summary Mode', game_count: 10 },
      ],
      selectedSeason: 1,
      selectedSeasonLabel: 'Season 1 — Long Context',
      selectedSeasonGameCount: 42,
      isLoading: false,
      setSelectedSeason: vi.fn(),
    });

    vi.mocked(useRankings).mockReturnValue({
      data: { data: [], total: 0, page: 1, per_page: 100, total_pages: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    render(<LeaderboardPage />);

    // Stat labels should include the season suffix "S1"
    await waitFor(() => {
      expect(screen.getByText(/Models Ranked/).textContent).toContain('S1');
      expect(screen.getByText(/Games Played/).textContent).toContain('S1');
    });
  });
});
