'use client';

import { useEffect, useState } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
// @ts-expect-error — plotly.js-basic-dist-min has no type declarations
import Plotly from 'plotly.js-basic-dist-min';
import type { ModelRanking } from '../../types/leaderboard';

const Plot = createPlotlyComponent(Plotly);

const MAX_CHART_MODELS = 15;

function isPortraitViewport() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth < window.innerHeight;
}

interface RatingChartProps {
  models: ModelRanking[];
}

export function RatingChart({ models }: RatingChartProps) {
  const [useVerticalLegend, setUseVerticalLegend] = useState(isPortraitViewport);

  useEffect(() => {
    const handleResize = () => {
      setUseVerticalLegend(isPortraitViewport());
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const chartModels = models.slice(0, MAX_CHART_MODELS);
  const modelNames = chartModels.map((m) => m.model_name);

  const makeHoverText = (
    model: ModelRanking,
    role: 'Overall' | 'Impostor' | 'Crewmate'
  ): string => {
    let rating: number, sigma: number, wins: number, losses: number, winRate: number;

    switch (role) {
      case 'Impostor':
        rating = model.impostor_rating;
        sigma = model.impostor_sigma;
        wins = model.impostor_wins;
        losses = model.impostor_games - model.impostor_wins;
        winRate = model.impostor_win_rate;
        break;
      case 'Crewmate':
        rating = model.crewmate_rating;
        sigma = model.crewmate_sigma;
        wins = model.crewmate_wins;
        losses = model.crewmate_games - model.crewmate_wins;
        winRate = model.crewmate_win_rate;
        break;
      default:
        rating = model.overall_rating;
        sigma = model.overall_sigma;
        wins = model.impostor_wins + model.crewmate_wins;
        losses = model.games_played - wins;
        winRate = model.win_rate;
        break;
    }

    return [
      `<b>${model.model_name} — ${role}</b>`,
      `Rating: ${Math.round(rating).toLocaleString()} ± ${Math.round(sigma).toLocaleString()}`,
      `Record: ${wins}W - ${losses}L (${winRate.toFixed(1)}%)`,
    ].join('<br>');
  };

  const traces = [
    {
      name: 'Overall',
      x: modelNames,
      y: chartModels.map((m) => m.overall_rating),
      error_y: {
        type: 'data' as const,
        array: chartModels.map((m) => m.overall_sigma),
        visible: true,
        color: '#a5b4fc',
        thickness: 1.5,
      },
      marker: { color: '#6366f1' },
      type: 'bar' as const,
      hovertext: chartModels.map((m) => makeHoverText(m, 'Overall')),
      hoverinfo: 'text' as const,
    },
    {
      name: 'Impostor',
      x: modelNames,
      y: chartModels.map((m) => m.impostor_rating),
      error_y: {
        type: 'data' as const,
        array: chartModels.map((m) => m.impostor_sigma),
        visible: true,
        color: '#fca5a5',
        thickness: 1.5,
      },
      marker: { color: '#ef4444' },
      type: 'bar' as const,
      hovertext: chartModels.map((m) => makeHoverText(m, 'Impostor')),
      hoverinfo: 'text' as const,
    },
    {
      name: 'Crewmate',
      x: modelNames,
      y: chartModels.map((m) => m.crewmate_rating),
      error_y: {
        type: 'data' as const,
        array: chartModels.map((m) => m.crewmate_sigma),
        visible: true,
        color: '#67e8f9',
        thickness: 1.5,
      },
      marker: { color: '#06b6d4' },
      type: 'bar' as const,
      hovertext: chartModels.map((m) => makeHoverText(m, 'Crewmate')),
      hoverinfo: 'text' as const,
    },
  ];

  const layout = {
    barmode: 'group' as const,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#94a3b8' },
    xaxis: {
      tickfont: { color: '#cbd5e1', size: 11 },
      gridcolor: 'rgba(51,65,85,0.5)',
    },
    yaxis: {
      title: { text: 'Rating (mu × 100)', font: { color: '#64748b', size: 12 } },
      tickfont: { color: '#94a3b8' },
      gridcolor: 'rgba(51,65,85,0.3)',
      zeroline: false,
    },
    legend: {
      orientation: useVerticalLegend ? ('v' as const) : ('h' as const),
      yanchor: useVerticalLegend ? ('top' as const) : ('bottom' as const),
      y: useVerticalLegend ? 1.14 : 1.02,
      xanchor: useVerticalLegend ? ('left' as const) : ('center' as const),
      x: useVerticalLegend ? 0 : 0.5,
      font: { color: '#94a3b8' },
    },
    margin: {
      l: 60,
      r: 20,
      t: useVerticalLegend ? 110 : 40,
      b: 80,
    },
    hoverlabel: {
      bgcolor: '#1e293b',
      bordercolor: '#475569',
      font: { color: '#e2e8f0', size: 13 },
    },
    autosize: true,
  };

  if (chartModels.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-white p-12 shadow-sm dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">No models to display</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-sm dark:bg-gray-900 p-4">
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Model Ratings</h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Hover for W-L record, exact rating, and uncertainty
      </p>
      <Plot
        data={traces}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
        style={{ width: '100%', height: '500px' }}
      />
    </div>
  );
}
