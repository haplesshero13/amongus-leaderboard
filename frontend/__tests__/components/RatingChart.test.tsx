import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RatingChart } from '@/components/features/RatingChart';
import type { ModelRanking } from '@/types/leaderboard';

type PlotProps = {
  data: Array<{
    orientation: string;
    x: string[] | number[];
    y: string[] | number[];
  }>;
  layout: {
    bargap: number;
    margin: {
      l: number;
    };
    xaxis: {
      tickfont: {
        color: string;
        size: number;
      };
    };
    yaxis: {
      tickfont: {
        color: string;
        size: number;
      };
    };
  };
  style: {
    height: string;
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

const manyMockRankings: ModelRanking[] = Array.from({ length: 40 }, (_, index) => ({
  ...mockRankings[0],
  model_id: `model-${index + 1}`,
  model_name: `Model ${index + 1}`,
}));

const sortableMockRankings: ModelRanking[] = [
  {
    ...mockRankings[0],
    model_id: 'overall-best',
    model_name: 'Overall Best',
    overall_rating: 2800,
    impostor_rating: 2300,
    crewmate_rating: 2400,
  },
  {
    ...mockRankings[0],
    model_id: 'impostor-best',
    model_name: 'Impostor Best',
    overall_rating: 2500,
    impostor_rating: 2900,
    crewmate_rating: 2200,
  },
  {
    ...mockRankings[0],
    model_id: 'crewmate-best',
    model_name: 'Crewmate Best',
    overall_rating: 2400,
    impostor_rating: 2100,
    crewmate_rating: 3000,
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

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  });
}

describe('RatingChart', () => {
  beforeEach(() => {
    latestPlotProps = null;
    mockMatchMedia(false);
  });

  it('uses vertical bars in wider viewports', () => {
    setViewport(1200, 800);

    render(<RatingChart models={mockRankings} />);

    expect(screen.getByTestId('rating-chart-plot')).toBeDefined();
    expect(latestPlotProps?.data[0].orientation).toBe('v');
    expect(latestPlotProps?.layout.bargap).toBeGreaterThan(0.22);
  });

  it('uses stronger category label contrast in light mode', () => {
    setViewport(1200, 800);

    render(<RatingChart models={mockRankings} />);

    expect(latestPlotProps?.layout.xaxis.tickfont.color).toBe('#235685');
    expect(latestPlotProps?.layout.xaxis.tickfont.size).toBe(12);

    fireEvent.click(screen.getByRole('button', { name: 'Stacked' }));

    expect(latestPlotProps?.layout.yaxis.tickfont.color).toBe('#235685');
    expect(latestPlotProps?.layout.yaxis.tickfont.size).toBe(12);
  });

  it('switches to horizontal bars in narrower viewports', () => {
    setViewport(1200, 800);

    render(<RatingChart models={mockRankings} />);

    act(() => {
      setViewport(700, 1000);
      window.dispatchEvent(new Event('resize'));
    });

    expect(latestPlotProps?.data[0].orientation).toBe('h');
    expect(latestPlotProps?.layout.margin.l).toBe(120);
  });

  it('lets the manual plot toggle override the automatic layout', () => {
    setViewport(1200, 800);

    render(<RatingChart models={mockRankings} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stacked' }));
    expect(latestPlotProps?.data[0].orientation).toBe('h');

    fireEvent.click(screen.getByRole('button', { name: 'Wide' }));
    expect(latestPlotProps?.data[0].orientation).toBe('v');
  });

  it('shows more models with a taller chart in compact mode', () => {
    setViewport(700, 1000);

    render(<RatingChart models={manyMockRankings} />);

    expect(latestPlotProps?.data[0].orientation).toBe('h');
    expect(latestPlotProps?.data[0].y).toHaveLength(30);
    expect(latestPlotProps?.style.height).toBe('1360px');
  });

  it('sorts models by the selected role and order', () => {
    setViewport(1200, 800);

    render(<RatingChart models={sortableMockRankings} />);

    expect(latestPlotProps?.data[0].x[0]).toBe('Overall Best');

    fireEvent.click(screen.getByRole('button', { name: 'Impostor' }));
    expect(latestPlotProps?.data[0].x[0]).toBe('Impostor Best');

    fireEvent.click(screen.getByRole('button', { name: 'Asc' }));
    expect(latestPlotProps?.data[0].x[0]).toBe('Crewmate Best');

    fireEvent.click(screen.getByRole('button', { name: 'Crewmate' }));
    expect(latestPlotProps?.data[0].x[0]).toBe('Impostor Best');
  });
});
