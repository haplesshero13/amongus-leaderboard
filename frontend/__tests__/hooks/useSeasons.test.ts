// frontend/__tests__/hooks/useSeasons.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/api/leaderboard', () => ({
  fetchSeasons: vi.fn(),
}));

import { fetchSeasons } from '@/lib/api/leaderboard';
import { useSeasons } from '@/lib/hooks/useSeasons';

describe('useSeasons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-selects the latest season on mount', async () => {
    vi.mocked(fetchSeasons).mockResolvedValue([
      { version: 1, label: 'Season 1 — Long Context', game_count: 42 },
      { version: 0, label: 'Season 0 — Summary Mode', game_count: 10 },
    ]);
    const { result } = renderHook(() => useSeasons());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });
    expect(result.current.selectedSeason).toBe(1);
    expect(result.current.selectedSeasonLabel).toBe('Season 1 — Long Context');
    expect(result.current.selectedSeasonGameCount).toBe(42);
    expect(result.current.seasons).toHaveLength(2);
  });

  it('allows changing the selected season', async () => {
    vi.mocked(fetchSeasons).mockResolvedValue([
      { version: 1, label: 'Season 1 — Long Context', game_count: 42 },
      { version: 0, label: 'Season 0 — Summary Mode', game_count: 10 },
    ]);
    const { result } = renderHook(() => useSeasons());
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });
    act(() => { result.current.setSelectedSeason(0); });
    expect(result.current.selectedSeason).toBe(0);
    expect(result.current.selectedSeasonLabel).toBe('Season 0 — Summary Mode');
    expect(result.current.selectedSeasonGameCount).toBe(10);
  });

  it('stays loading when fetch fails', async () => {
    vi.mocked(fetchSeasons).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useSeasons());
    await waitFor(() => { expect(result.current.seasons).toHaveLength(0); });
  });
});
