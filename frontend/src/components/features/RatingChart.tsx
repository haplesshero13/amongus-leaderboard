'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
// @ts-expect-error — plotly.js-basic-dist-min has no type declarations
import Plotly from 'plotly.js-basic-dist-min';
import type { ModelRanking } from '../../types/leaderboard';
import { amongUsPalette } from '../../lib/theme/amongUsPalette';

const Plot = createPlotlyComponent(Plotly);

const DEFAULT_MAX_CHART_MODELS = 15;
const COMPACT_MAX_CHART_MODELS = 30;
const MOBILE_PLOT_BREAKPOINT = 768;
const COMPACT_MIN_HEIGHT = 760;
const CHART_MARGIN_LEFT = 60;
const COMPACT_MARGIN_LEFT = 120;
const CHART_MARGIN_RIGHT = 20;
const CHART_MARGIN_TOP = 40;
const CHART_MARGIN_BOTTOM = 80;
const DEFAULT_BARGAP = 0.22;
const TRACE_COUNT = 3;

type PlotOrientationMode = 'auto' | 'vertical' | 'horizontal';
type ChartSortField = 'overall' | 'impostor' | 'crewmate';
type ChartSortDirection = 'asc' | 'desc';

const PLOT_MODE_LABELS: Record<PlotOrientationMode, string> = {
  auto: 'Auto',
  vertical: 'Wide',
  horizontal: 'Stacked',
};

const SORT_FIELD_LABELS: Record<ChartSortField, string> = {
  overall: 'Overall',
  impostor: 'Impostor',
  crewmate: 'Crewmate',
};

const SORT_DIRECTION_LABELS: Record<ChartSortDirection, string> = {
  asc: 'Asc',
  desc: 'Desc',
};

function isNarrowViewport() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth < MOBILE_PLOT_BREAKPOINT;
}

function getInitialPlotWidth() {
  if (typeof window === 'undefined') {
    return 1024;
  }

  return window.innerWidth;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

interface RatingChartProps {
  models: ModelRanking[];
}

export function RatingChart({ models }: RatingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotOrientationMode, setPlotOrientationMode] = useState<PlotOrientationMode>('auto');
  const [useHorizontalPlot, setUseHorizontalPlot] = useState(isNarrowViewport);
  const [plotWidth, setPlotWidth] = useState(getInitialPlotWidth);
  const [sortField, setSortField] = useState<ChartSortField>('overall');
  const [sortDirection, setSortDirection] = useState<ChartSortDirection>('desc');

  useEffect(() => {
    const handleResize = () => {
      setUseHorizontalPlot(isNarrowViewport());
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      const measuredWidth = containerRef.current?.clientWidth ?? 0;
      setPlotWidth(measuredWidth > 0 ? measuredWidth : getInitialPlotWidth());
    };

    updateWidth();

    if (typeof window === 'undefined' || !('ResizeObserver' in window) || !containerRef.current) {
      return undefined;
    }

    const resizeObserver = new window.ResizeObserver(() => {
      updateWidth();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const isHorizontalPlot = plotOrientationMode === 'horizontal' ||
    (plotOrientationMode === 'auto' && useHorizontalPlot);

  const maxChartModels = isHorizontalPlot ? COMPACT_MAX_CHART_MODELS : DEFAULT_MAX_CHART_MODELS;
  const sortedModels = useMemo(() => {
    const getSortValue = (model: ModelRanking) => {
      switch (sortField) {
        case 'impostor':
          return model.impostor_rating;
        case 'crewmate':
          return model.crewmate_rating;
        default:
          return model.overall_rating;
      }
    };

    return [...models].sort((a, b) => {
      const difference = getSortValue(a) - getSortValue(b);

      if (difference !== 0) {
        return sortDirection === 'asc' ? difference : -difference;
      }

      return a.model_name.localeCompare(b.model_name);
    });
  }, [models, sortDirection, sortField]);

  const chartModels = sortedModels.slice(0, maxChartModels);
  const modelNames = chartModels.map((m) => m.model_name);
  const baselinePlotWidth = Math.max(plotWidth - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT, 240);
  const baselineCategorySpan = baselinePlotWidth / DEFAULT_MAX_CHART_MODELS;
  const targetGroupThickness = baselineCategorySpan * (1 - DEFAULT_BARGAP);
  const targetBarThickness = targetGroupThickness / TRACE_COUNT;
  const currentWideCategorySpan = baselinePlotWidth / Math.max(chartModels.length, 1);
  const wideModeBargap = clamp(
    1 - (targetBarThickness * TRACE_COUNT) / currentWideCategorySpan,
    DEFAULT_BARGAP,
    0.92
  );
  const chartHeight = isHorizontalPlot
    ? Math.max(
      COMPACT_MIN_HEIGHT,
      CHART_MARGIN_TOP + CHART_MARGIN_BOTTOM + chartModels.length * baselineCategorySpan
    )
    : 500;

  const buildTrace = (
    name: 'Overall' | 'Impostor' | 'Crewmate',
    color: string,
    lineColor: string,
    errorColor: string,
    ratings: number[],
    sigmas: number[]
  ) => ({
    name,
    x: isHorizontalPlot ? ratings : modelNames,
    y: isHorizontalPlot ? modelNames : ratings,
    orientation: isHorizontalPlot ? ('h' as const) : ('v' as const),
    error_x: isHorizontalPlot
      ? {
        type: 'data' as const,
        array: sigmas,
        visible: true,
        color: errorColor,
        thickness: 1.5,
      }
      : undefined,
    error_y: !isHorizontalPlot
      ? {
        type: 'data' as const,
        array: sigmas,
        visible: true,
        color: errorColor,
        thickness: 1.5,
      }
      : undefined,
    marker: {
      color,
      line: {
        color: lineColor,
        width: 1.25,
      },
    },
    type: 'bar' as const,
    hovertext: chartModels.map((m) => makeHoverText(m, name)),
    hoverinfo: 'text' as const,
  });

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
    buildTrace(
      'Overall',
      amongUsPalette.chart.overall,
      amongUsPalette.chart.overallOutline,
      amongUsPalette.chart.overallError,
      chartModels.map((m) => m.overall_rating),
      chartModels.map((m) => m.overall_sigma)
    ),
    buildTrace(
      'Impostor',
      amongUsPalette.chart.impostor,
      amongUsPalette.chart.impostorOutline,
      amongUsPalette.chart.impostorError,
      chartModels.map((m) => m.impostor_rating),
      chartModels.map((m) => m.impostor_sigma)
    ),
    buildTrace(
      'Crewmate',
      amongUsPalette.chart.crewmate,
      amongUsPalette.chart.crewmateOutline,
      amongUsPalette.chart.crewmateError,
      chartModels.map((m) => m.crewmate_rating),
      chartModels.map((m) => m.crewmate_sigma)
    ),
  ];

  const layout = {
    barmode: 'group' as const,
    bargap: isHorizontalPlot ? DEFAULT_BARGAP : wideModeBargap,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#94a3b8' },
    xaxis: {
      title: isHorizontalPlot
        ? { text: 'Rating (mu × 100)', font: { color: '#64748b', size: 12 } }
        : undefined,
      tickfont: { color: '#cbd5e1', size: 11 },
      gridcolor: 'rgba(51,65,85,0.5)',
    },
    yaxis: {
      title: !isHorizontalPlot
        ? { text: 'Rating (mu × 100)', font: { color: '#64748b', size: 12 } }
        : undefined,
      tickfont: { color: '#94a3b8' },
      gridcolor: 'rgba(51,65,85,0.3)',
      zeroline: false,
      automargin: true,
      autorange: isHorizontalPlot ? ('reversed' as const) : undefined,
    },
    legend: {
      orientation: 'h' as const,
      yanchor: 'bottom' as const,
      y: 1.02,
      xanchor: 'center' as const,
      x: 0.5,
      font: { color: '#94a3b8' },
    },
    margin: {
      l: isHorizontalPlot ? COMPACT_MARGIN_LEFT : CHART_MARGIN_LEFT,
      r: CHART_MARGIN_RIGHT,
      t: CHART_MARGIN_TOP,
      b: CHART_MARGIN_BOTTOM,
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
    <div ref={containerRef} className="rounded-xl bg-white shadow-sm dark:bg-gray-900 p-4">
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Model Ratings</h2>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Hover for W-L record, exact rating, and uncertainty
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
            Plot
          </span>
          <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {(['auto', 'vertical', 'horizontal'] as const).map((mode) => {
              const isActive = plotOrientationMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPlotOrientationMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                  }`}
                >
                  {PLOT_MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
            Sort
          </span>
          <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {(['overall', 'impostor', 'crewmate'] as const).map((field) => {
              const isActive = sortField === field;
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => setSortField(field)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                  }`}
                >
                  {SORT_FIELD_LABELS[field]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
            Order
          </span>
          <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {(['desc', 'asc'] as const).map((direction) => {
              const isActive = sortDirection === direction;
              return (
                <button
                  key={direction}
                  type="button"
                  onClick={() => setSortDirection(direction)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                  }`}
                >
                  {SORT_DIRECTION_LABELS[direction]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <Plot
        data={traces}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
        style={{ width: '100%', height: `${chartHeight}px` }}
      />
    </div>
  );
}
