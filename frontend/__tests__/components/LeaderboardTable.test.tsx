import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardTable } from '@/components/features/LeaderboardTable';
import { ModelRanking } from '@/types/leaderboard';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const mockRankings: ModelRanking[] = [
  {
    model_id: 'gpt-5',
    model_name: 'GPT-5',
    provider: 'OpenAI',
    avatar_color: '#10A37F',
    overall_rating: 1850,
    impostor_rating: 1900,
    crewmate_rating: 1800,
    overall_sigma: 200,
    impostor_sigma: 250,
    crewmate_sigma: 180,
    games_played: 42,
    current_rank: 1,
    impostor_games: 12,
    impostor_wins: 8,
    crewmate_games: 30,
    crewmate_wins: 18,
    win_rate: 61.9,
    impostor_win_rate: 66.7,
    crewmate_win_rate: 60.0,
    release_date: '2025-01-01',
  },
  {
    model_id: 'claude-4',
    model_name: 'Claude 4',
    provider: 'Anthropic',
    avatar_color: '#D97706',
    overall_rating: 1820,
    impostor_rating: 1750,
    crewmate_rating: 1890,
    overall_sigma: 210,
    impostor_sigma: 280,
    crewmate_sigma: 160,
    games_played: 38,
    current_rank: 2,
    impostor_games: 10,
    impostor_wins: 4,
    crewmate_games: 28,
    crewmate_wins: 20,
    win_rate: 63.2,
    impostor_win_rate: 40.0,
    crewmate_win_rate: 71.4,
    release_date: '2025-02-01',
  },
];

const defaultSortProps = {
  sortField: 'overall_rating' as const,
  sortDirection: 'desc' as const,
  onSort: vi.fn(),
};

describe('LeaderboardTable', () => {
  it('renders model names', () => {
    render(<LeaderboardTable rankings={mockRankings} {...defaultSortProps} />);
    expect(screen.getByText('GPT-5')).toBeDefined();
    expect(screen.getByText('Claude 4')).toBeDefined();
  });

  it('renders provider names', () => {
    render(<LeaderboardTable rankings={mockRankings} {...defaultSortProps} />);
    expect(screen.getByText('OpenAI')).toBeDefined();
    expect(screen.getByText('Anthropic')).toBeDefined();
  });

  it('renders overall ratings', () => {
    render(<LeaderboardTable rankings={mockRankings} {...defaultSortProps} />);
    // Now displays conservative ratings (rating - sigma) prominently
    // Note: 1650 appears in both overall and impostor columns, so use getAllByText
    expect(screen.getAllByText('1650').length).toBeGreaterThan(0); // GPT-5: 1850 - 200 (overall) and 1900 - 250 (impostor)
    expect(screen.getByText('1610')).toBeDefined(); // Claude 4: 1820 - 210
    // Average ratings shown in "Avg:" text
    expect(screen.getByText(/Avg:\s*1850/)).toBeDefined();
    expect(screen.getByText(/Avg:\s*1820/)).toBeDefined();
  });

  it('renders win-loss records', () => {
    render(<LeaderboardTable rankings={mockRankings} {...defaultSortProps} />);
    // GPT-5: 26 wins (8+18), 16 losses (42-26)
    expect(screen.getByText('26-16')).toBeDefined();
    // Claude 4: 24 wins (4+20), 14 losses (38-24)
    expect(screen.getByText('24-14')).toBeDefined();
  });

  it('renders empty table without crashing', () => {
    render(<LeaderboardTable rankings={[]} {...defaultSortProps} />);
    // Should render header but no rows
    expect(screen.getByText('Rank')).toBeDefined();
    expect(screen.getByText('Model')).toBeDefined();
  });
});
