import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RatingChart } from '@/components/features/RatingChart';
import type { ModelRanking } from '@/types/leaderboard';

type PlotProps = {
  layout: {
    legend: {
      orientation: string;
    };
    margin: {
      t: number;
    };
  };
};

let latestPlotProps: PlotProps | null = null;

vi.mock('react-plotly.js/factory', () => ({
  default: () => {
    return (props: PlotProps) => {
      latestPlotProps = props;
      return <div data-testid="rating-chart-plot" />;
    };
  },
}));

vi.mock('plotly.js-basic-dist-min', () => ({
  default: {},
}));

const mockRankings: ModelRanking[] = [
  {
    model_id: 'gpt-5-mini',
    model_name: 'GPT-5 Mini',
    provider: 'OpenAI',
    avatar_color: '#10b981',
    overall_rating: 2500,
    impostor_rating: 2550,
    crewmate_rating: 2450,
    overall_sigma: 120,
    impostor_sigma: 140,
    crewmate_sigma: 110,
    games_played: 24,
    current_rank: 1,
    impostor_games: 8,
    impostor_wins: 5,
    crewmate_games: 16,
    crewmate_wins: 10,
    win_rate: 62.5,
    impostor_win_rate: 62.5,
    crewmate_win_rate: 62.5,
    release_date: '2026-01-01',
  },
];

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  });
}

describe('RatingChart', () => {
  beforeEach(() => {
    latestPlotProps = null;
  });

  it('uses a horizontal legend in wider viewports', () => {
    setViewport(1200, 800);

    render(<RatingChart models={mockRankings} />);

    expect(screen.getByTestId('rating-chart-plot')).toBeDefined();
    expect(latestPlotProps?.layout.legend.orientation).toBe('h');
  });

  it('switches to a vertical legend in portrait viewports', () => {
    setViewport(1200, 800);

    render(<RatingChart models={mockRankings} />);

    act(() => {
      setViewport(700, 1000);
      window.dispatchEvent(new Event('resize'));
    });

    expect(latestPlotProps?.layout.legend.orientation).toBe('v');
    expect(latestPlotProps?.layout.margin.t).toBe(110);
  });
});
