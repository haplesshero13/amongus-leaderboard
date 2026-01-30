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
    overall_sigma: 250,
    impostor_sigma: 300,
    crewmate_sigma: 200,
    games_played: 25,
    current_rank: 3,
    impostor_games: 8,
    impostor_wins: 5,
    crewmate_games: 17,
    crewmate_wins: 10,
    win_rate: 60.0,
    impostor_win_rate: 62.5,
    crewmate_win_rate: 58.8,
    release_date: '2025-03-01',
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
    // Now displays conservative ratings (rating - sigma) prominently
    expect(screen.getByText('1530')).toBeDefined(); // overall: 1780 - 250
    expect(screen.getByText('1520')).toBeDefined(); // impostor: 1820 - 300
    expect(screen.getByText('1540')).toBeDefined(); // crewmate: 1740 - 200
    // Average ratings shown in "Avg:" text
    expect(screen.getByText(/Avg:\s*1780/)).toBeDefined();
    expect(screen.getByText(/Avg:\s*1820/)).toBeDefined();
    expect(screen.getByText(/Avg:\s*1740/)).toBeDefined();
  });

  it('renders win-loss record', () => {
    render(<LeaderboardCards rankings={mockRankings} />);
    // 15 wins (5+10), 10 losses (25-15)
    expect(screen.getByText('15-10')).toBeDefined();
  });

  it('renders empty list without crashing', () => {
    const { container } = render(<LeaderboardCards rankings={[]} />);
    // Should render container but no cards
    expect(container.querySelector('.space-y-3')).toBeDefined();
  });
});
