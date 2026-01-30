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

vi.mock('@/lib/hooks/useGames', () => ({
  useGames: vi.fn(),
}));

import { useRankings } from '@/lib/hooks/useRankings';
import { useGames } from '@/lib/hooks/useGames';

// Import the page component after mocking
import Home from '@/app/page';

describe('StatsBar games count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays exact count of completed games from API', async () => {
    // Mock 3 models with varying games_played (totaling way more than 5)
    const mockRankings = {
      data: [
        { model_id: 'm1', model_name: 'Model 1', provider: 'Test', avatar_color: '#FF0000', impostor_rating: 2600, crewmate_rating: 2400, overall_rating: 2500, games_played: 10, current_rank: 1, impostor_games: 5, impostor_wins: 3, crewmate_games: 5, crewmate_wins: 2, win_rate: 50, impostor_win_rate: 60, crewmate_win_rate: 40, release_date: '2025-01-01' },
        { model_id: 'm2', model_name: 'Model 2', provider: 'Test', avatar_color: '#00FF00', impostor_rating: 2500, crewmate_rating: 2550, overall_rating: 2525, games_played: 8, current_rank: 2, impostor_games: 4, impostor_wins: 2, crewmate_games: 4, crewmate_wins: 2, win_rate: 50, impostor_win_rate: 50, crewmate_win_rate: 50, release_date: '2025-01-01' },
        { model_id: 'm3', model_name: 'Model 3', provider: 'Test', avatar_color: '#0000FF', impostor_rating: 2400, crewmate_rating: 2300, overall_rating: 2350, games_played: 7, current_rank: 3, impostor_games: 3, impostor_wins: 1, crewmate_games: 4, crewmate_wins: 1, win_rate: 28.6, impostor_win_rate: 33.3, crewmate_win_rate: 25, release_date: '2025-01-01' },
      ],
      total: 3,
      page: 1,
      per_page: 100,
      total_pages: 1,
    };

    // Mock exactly 5 completed games - this is the source of truth
    const mockGames = [
      { game_id: 'g1', status: 'completed' as const, started_at: null, ended_at: null, winner: 1, winner_reason: 'Test', participants: [], error_message: null },
      { game_id: 'g2', status: 'completed' as const, started_at: null, ended_at: null, winner: 1, winner_reason: 'Test', participants: [], error_message: null },
      { game_id: 'g3', status: 'completed' as const, started_at: null, ended_at: null, winner: 2, winner_reason: 'Test', participants: [], error_message: null },
      { game_id: 'g4', status: 'completed' as const, started_at: null, ended_at: null, winner: 1, winner_reason: 'Test', participants: [], error_message: null },
      { game_id: 'g5', status: 'completed' as const, started_at: null, ended_at: null, winner: 2, winner_reason: 'Test', participants: [], error_message: null },
    ];

    vi.mocked(useRankings).mockReturnValue({
      data: mockRankings,
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    vi.mocked(useGames).mockReturnValue({
      data: mockGames,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<Home />);

    // The "Games Played" stat should show 5 (actual game count)
    // NOT 25 (sum of games_played across models: 10+8+7=25)
    await waitFor(() => {
      const gamesPlayedCard = screen.getByText('Games Played').closest('div')?.parentElement;
      expect(gamesPlayedCard).toBeDefined();
      
      // Find the number in the card
      const numberElement = gamesPlayedCard?.querySelector('.text-2xl');
      expect(numberElement?.textContent).toBe('5');
    });
  });

  it('displays 0 games when no completed games exist', async () => {
    vi.mocked(useRankings).mockReturnValue({
      data: { data: [], total: 0, page: 1, per_page: 100, total_pages: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    vi.mocked(useGames).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<Home />);

    await waitFor(() => {
      const gamesPlayedCard = screen.getByText('Games Played').closest('div')?.parentElement;
      const numberElement = gamesPlayedCard?.querySelector('.text-2xl');
      expect(numberElement?.textContent).toBe('0');
    });
  });

  it('displays top impostor model name', async () => {
    const mockRankings = {
      data: [
        { model_id: 'm1', model_name: 'GPT-5', provider: 'OpenAI', avatar_color: '#10A37F', impostor_rating: 2800, crewmate_rating: 2400, overall_rating: 2600, games_played: 10, current_rank: 1, impostor_games: 5, impostor_wins: 4, crewmate_games: 5, crewmate_wins: 2, win_rate: 60, impostor_win_rate: 80, crewmate_win_rate: 40, release_date: '2025-01-01' },
        { model_id: 'm2', model_name: 'Claude 4', provider: 'Anthropic', avatar_color: '#D97706', impostor_rating: 2600, crewmate_rating: 2700, overall_rating: 2650, games_played: 8, current_rank: 2, impostor_games: 4, impostor_wins: 2, crewmate_games: 4, crewmate_wins: 3, win_rate: 62.5, impostor_win_rate: 50, crewmate_win_rate: 75, release_date: '2025-01-01' },
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

    vi.mocked(useGames).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<Home />);

    // GPT-5 has highest impostor rating (2800) - appears in stats bar AND leaderboard
    await waitFor(() => {
      const matches = screen.getAllByText('GPT-5');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      // First one should be in the stats bar with red color
      expect(matches[0].className).toContain('text-red-600');
    });
  });

  it('displays top crewmate model name', async () => {
    const mockRankings = {
      data: [
        { model_id: 'm1', model_name: 'GPT-5', provider: 'OpenAI', avatar_color: '#10A37F', impostor_rating: 2800, crewmate_rating: 2400, overall_rating: 2600, games_played: 10, current_rank: 1, impostor_games: 5, impostor_wins: 4, crewmate_games: 5, crewmate_wins: 2, win_rate: 60, impostor_win_rate: 80, crewmate_win_rate: 40, release_date: '2025-01-01' },
        { model_id: 'm2', model_name: 'Claude 4', provider: 'Anthropic', avatar_color: '#D97706', impostor_rating: 2600, crewmate_rating: 2700, overall_rating: 2650, games_played: 8, current_rank: 2, impostor_games: 4, impostor_wins: 2, crewmate_games: 4, crewmate_wins: 3, win_rate: 62.5, impostor_win_rate: 50, crewmate_win_rate: 75, release_date: '2025-01-01' },
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

    vi.mocked(useGames).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<Home />);

    // Claude 4 has highest crewmate rating (2700) - appears in stats bar AND leaderboard
    await waitFor(() => {
      const matches = screen.getAllByText('Claude 4');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      // First one should be in the stats bar with cyan color
      expect(matches[0].className).toContain('text-cyan-600');
    });
  });
});
