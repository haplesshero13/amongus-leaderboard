import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardTable } from '@/components/features/LeaderboardTable';
import { ModelRanking } from '@/types/leaderboard';

const mockRankings: ModelRanking[] = [
  {
    model_id: 'gpt-5',
    model_name: 'GPT-5',
    provider: 'OpenAI',
    avatar_color: '#10A37F',
    overall_rating: 1850,
    impostor_rating: 1900,
    crewmate_rating: 1800,
    games_played: 42,
    current_rank: 1,
    rank_change: 2,
  },
  {
    model_id: 'claude-4',
    model_name: 'Claude 4',
    provider: 'Anthropic',
    avatar_color: '#D97706',
    overall_rating: 1820,
    impostor_rating: 1750,
    crewmate_rating: 1890,
    games_played: 38,
    current_rank: 2,
    rank_change: -1,
  },
];

describe('LeaderboardTable', () => {
  it('renders model names', () => {
    render(<LeaderboardTable rankings={mockRankings} />);
    expect(screen.getByText('GPT-5')).toBeDefined();
    expect(screen.getByText('Claude 4')).toBeDefined();
  });

  it('renders provider names', () => {
    render(<LeaderboardTable rankings={mockRankings} />);
    expect(screen.getByText('OpenAI')).toBeDefined();
    expect(screen.getByText('Anthropic')).toBeDefined();
  });

  it('renders overall ratings', () => {
    render(<LeaderboardTable rankings={mockRankings} />);
    expect(screen.getByText('1850')).toBeDefined();
    expect(screen.getByText('1820')).toBeDefined();
  });

  it('renders games played', () => {
    render(<LeaderboardTable rankings={mockRankings} />);
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('38')).toBeDefined();
  });

  it('renders empty table without crashing', () => {
    render(<LeaderboardTable rankings={[]} />);
    // Should render header but no rows
    expect(screen.getByText('Rank')).toBeDefined();
    expect(screen.getByText('Model')).toBeDefined();
  });
});
