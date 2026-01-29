import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardCards } from '@/components/features/LeaderboardCards';
import { ModelRanking } from '@/types/leaderboard';

const mockRankings: ModelRanking[] = [
  {
    model_id: 'gemini-3',
    model_name: 'Gemini 3',
    provider: 'Google',
    avatar_color: '#4285F4',
    overall_rating: 1780,
    impostor_rating: 1820,
    crewmate_rating: 1740,
    games_played: 25,
    current_rank: 3,
    rank_change: 0,
  },
];

describe('LeaderboardCards', () => {
  it('renders model name and provider', () => {
    render(<LeaderboardCards rankings={mockRankings} />);
    expect(screen.getByText('Gemini 3')).toBeDefined();
    expect(screen.getByText('Google')).toBeDefined();
  });

  it('renders all rating types', () => {
    render(<LeaderboardCards rankings={mockRankings} />);
    expect(screen.getByText('1780')).toBeDefined(); // overall
    expect(screen.getByText('1820')).toBeDefined(); // impostor
    expect(screen.getByText('1740')).toBeDefined(); // crewmate
  });

  it('renders games played', () => {
    render(<LeaderboardCards rankings={mockRankings} />);
    expect(screen.getByText('25')).toBeDefined();
  });

  it('renders empty list without crashing', () => {
    const { container } = render(<LeaderboardCards rankings={[]} />);
    // Should render container but no cards
    expect(container.querySelector('.space-y-3')).toBeDefined();
  });
});
