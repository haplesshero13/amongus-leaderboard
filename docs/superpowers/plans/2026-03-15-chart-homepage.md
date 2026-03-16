# Chart-Based Home Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the leaderboard table at `/` with a Plotly chart page; move the table to `/leaderboard`; fix season logic bugs.

**Architecture:** Centralize season state into a `useSeasons` hook, fix StatsBar filtering bugs, restructure routes, then build a new Plotly-based chart home page. All changes are frontend-only.

**Tech Stack:** Next.js 15, React 19, TypeScript, Plotly.js (basic-dist-min), TailwindCSS, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/lib/hooks/useSeasons.ts` | Create | Centralized season fetching, selection state, game count |
| `frontend/src/components/features/SeasonSelector.tsx` | Modify | Becomes controlled component (no internal fetch) |
| `frontend/src/app/page.tsx` | Rewrite | New chart home page with Plotly |
| `frontend/src/app/leaderboard/page.tsx` | Create | Old leaderboard content moved here |
| `frontend/src/components/features/Leaderboard.tsx` | Modify | Remove internal SeasonSelector, receive season from parent |
| `frontend/src/components/features/RatingChart.tsx` | Create | Plotly grouped bar chart component |
| `frontend/src/components/layout/PageLayout.tsx` | Modify | Update nav links and footer links |
| `frontend/src/app/games/[id]/page.tsx` | Modify | Replace custom header with PageLayout, move "Game Log" title to content |
| `frontend/__tests__/components/StatsBar.test.tsx` | Modify | Update imports, mock changes |
| `frontend/__tests__/hooks/useSeasons.test.ts` | Create | Test the new hook |

---

## Chunk 1: Season Logic & Route Restructure (Phase 1 + Phase 2)

### Task 1: Create `useSeasons` Hook

**Files:**
- Create: `frontend/src/lib/hooks/useSeasons.ts`
- Create: `frontend/__tests__/hooks/useSeasons.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
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
      { version: 0, label: 'Season 0 — Skip Vote', game_count: 10 },
    ]);

    const { result } = renderHook(() => useSeasons());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should auto-select latest (version 1)
    expect(result.current.selectedSeason).toBe(1);
    expect(result.current.selectedSeasonLabel).toBe('Season 1 — Long Context');
    expect(result.current.selectedSeasonGameCount).toBe(42);
    expect(result.current.seasons).toHaveLength(2);
  });

  it('allows changing the selected season', async () => {
    vi.mocked(fetchSeasons).mockResolvedValue([
      { version: 1, label: 'Season 1 — Long Context', game_count: 42 },
      { version: 0, label: 'Season 0 — Skip Vote', game_count: 10 },
    ]);

    const { result } = renderHook(() => useSeasons());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSelectedSeason(0);
    });

    expect(result.current.selectedSeason).toBe(0);
    expect(result.current.selectedSeasonLabel).toBe('Season 0 — Skip Vote');
    expect(result.current.selectedSeasonGameCount).toBe(10);
  });

  it('stays loading when fetch fails', async () => {
    vi.mocked(fetchSeasons).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSeasons());

    await waitFor(() => {
      // Should still be loading since we have no valid season to select
      // The hook can't resolve to a valid state without seasons
      expect(result.current.seasons).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test -- __tests__/hooks/useSeasons.test.ts`
Expected: FAIL — module `@/lib/hooks/useSeasons` not found

- [ ] **Step 3: Write the hook**

```typescript
// frontend/src/lib/hooks/useSeasons.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Season } from '../../types/leaderboard';
import { fetchSeasons } from '../api/leaderboard';

interface UseSeasonsReturn {
  seasons: Season[];
  selectedSeason: number;
  selectedSeasonLabel: string | null;
  selectedSeasonGameCount: number;
  isLoading: boolean;
  setSelectedSeason: (version: number) => void;
}

export function useSeasons(): UseSeasonsReturn {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeasonState] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetchSeasons()
      .then((data) => {
        if (!isMounted) return;
        const sorted = data.sort((a, b) => b.version - a.version);
        setSeasons(sorted);
        if (sorted.length > 0) {
          setSelectedSeasonState(sorted[0].version);
          setIsLoading(false);
        }
      })
      .catch(() => {
        // Can't resolve to a valid state without seasons
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setSelectedSeason = useCallback((version: number) => {
    setSelectedSeasonState(version);
  }, []);

  const selectedSeasonData = seasons.find((s) => s.version === selectedSeason);

  return {
    seasons,
    selectedSeason,
    selectedSeasonLabel: selectedSeasonData?.label ?? null,
    selectedSeasonGameCount: selectedSeasonData?.game_count ?? 0,
    isLoading,
    setSelectedSeason,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bun run test -- __tests__/hooks/useSeasons.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/lib/hooks/useSeasons.ts __tests__/hooks/useSeasons.test.ts && git commit -m "feat: add useSeasons hook for centralized season state"
```

---

### Task 2: Convert SeasonSelector to Controlled Component

**Files:**
- Modify: `frontend/src/components/features/SeasonSelector.tsx`

- [ ] **Step 1: Rewrite SeasonSelector as controlled component**

Replace the entire file content with:

```typescript
// frontend/src/components/features/SeasonSelector.tsx
'use client';

import { Season } from '../../types/leaderboard';

interface SeasonSelectorProps {
  seasons: Season[];
  selectedVersion: number;
  onSeasonChange: (version: number) => void;
}

export function SeasonSelector({ seasons, selectedVersion, onSeasonChange }: SeasonSelectorProps) {
  if (seasons.length <= 1) {
    return null;
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {seasons.map((season) => {
        const isSelected = selectedVersion === season.version;

        return (
          <button
            key={season.version}
            onClick={() => onSeasonChange(season.version)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${isSelected
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
          >
            {season.label}
            <span className={`ml-2 text-xs ${isSelected ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
              {season.game_count} games
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

Key changes from original:
- Removed `useState`, `useEffect`, `fetchSeasons` — no longer fetches internally
- Props now include `seasons: Season[]` (passed from parent hook)
- `selectedVersion` changed from `number | null` to `number`
- `onSeasonChange` simplified from `(version: number | null, label: string | null)` to `(version: number)`
- No loading state — parent controls visibility via `isLoading` from `useSeasons`

- [ ] **Step 2: Run type-check to verify no type errors**

Run: `cd frontend && bun run type-check`
Expected: Type errors in `Leaderboard.tsx` and `page.tsx` (they still use the old prop types) — this is expected and will be fixed in next tasks.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/features/SeasonSelector.tsx && git commit -m "refactor: convert SeasonSelector to controlled component"
```

---

### Task 3: Update Leaderboard to Use External Season State

**Files:**
- Modify: `frontend/src/components/features/Leaderboard.tsx`

- [ ] **Step 1: Update Leaderboard props and remove internal SeasonSelector rendering**

Change the interface and remove `SeasonSelector` from the component's JSX. The parent page will render `SeasonSelector` instead.

```typescript
// Updated interface (line 16-19)
interface LeaderboardProps {
  selectedSeason: number;
}
```

Remove the `onSeasonChange` prop. Remove `handleSeasonChange` callback. Remove all `<SeasonSelector .../>` usages from the JSX (there are 4 instances: loading state, error state, empty state, and main render).

Update `useRankings` call: change `selectedSeason` parameter from `number | null` to `number`.

Update the `previousSeasonRef` type from `useRef<number | null>` to `useRef<number>`.

Update the `totalModels` reference that currently uses `data?.total` — replace with `sorted.length` (already the case in the `useMemo` at line 101).

- [ ] **Step 2: Run type-check**

Run: `cd frontend && bun run type-check`
Expected: Type errors in `page.tsx` (still passes old props) — will be fixed in next task.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/features/Leaderboard.tsx && git commit -m "refactor: remove internal season management from Leaderboard"
```

---

### Task 4: Fix StatsBar Bugs and Wire Up useSeasons in page.tsx

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Rewrite page.tsx with useSeasons hook and fixed StatsBar**

Replace the entire file:

```typescript
// frontend/src/app/page.tsx
'use client';

import { PageLayout } from '../components/layout/PageLayout';
import { Leaderboard } from '../components/features/Leaderboard';
import { SeasonSelector } from '../components/features/SeasonSelector';
import { useSeasons } from '../lib/hooks/useSeasons';
import { useRankings } from '../lib/hooks/useRankings';
import { getConservativeRating } from '../types/leaderboard';

function getSeasonSuffix(selectedSeason: number): string {
  return `S${selectedSeason}`;
}

function StatsBar({ selectedSeason, seasonGameCount }: { selectedSeason: number; seasonGameCount: number }) {
  const { data, isLoading } = useRankings(1, 100, selectedSeason);

  const models = data?.data ?? [];
  const modelsWithImpostorGames = models.filter((m) => m.impostor_games > 0);
  const modelsWithCrewmateGames = models.filter((m) => m.crewmate_games > 0);

  const topImpostor = modelsWithImpostorGames.length > 0
    ? modelsWithImpostorGames.reduce((best, m) =>
      getConservativeRating(m.impostor_rating, m.impostor_sigma) >
        getConservativeRating(best.impostor_rating, best.impostor_sigma) ? m : best
    )
    : undefined;
  const topCrewmate = modelsWithCrewmateGames.length > 0
    ? modelsWithCrewmateGames.reduce((best, m) =>
      getConservativeRating(m.crewmate_rating, m.crewmate_sigma) >
        getConservativeRating(best.crewmate_rating, best.crewmate_sigma) ? m : best
    )
    : undefined;

  const suffix = getSeasonSuffix(selectedSeason);
  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isLoading ? '...' : formatNumber(models.length)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Models Ranked — {suffix}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(seasonGameCount)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Games Played — {suffix}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="text-xl font-bold text-red-600 dark:text-red-400 truncate">
            {isLoading ? '...' : (topImpostor?.model_name ?? '—')}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Top Impostor{' '}
            {topImpostor && !isLoading && (
              <span className="font-medium">
                ({getConservativeRating(topImpostor.impostor_rating, topImpostor.impostor_sigma)})
              </span>
            )}
            {' '}— {suffix}
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 truncate">
            {isLoading ? '...' : (topCrewmate?.model_name ?? '—')}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Top Crewmate{' '}
            {topCrewmate && !isLoading && (
              <span className="font-medium">
                ({getConservativeRating(topCrewmate.crewmate_rating, topCrewmate.crewmate_sigma)})
              </span>
            )}
            {' '}— {suffix}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { seasons, selectedSeason, isLoading, setSelectedSeason, selectedSeasonGameCount } = useSeasons();

  if (isLoading) {
    return (
      <PageLayout activePage="/">
        <div className="flex items-center justify-center p-12">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePage="/">
      {/* About section */}
      <div className="mb-8 space-y-6 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <div>
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            LM Deception Arena
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            A live leaderboard where we have frontier and open-weight LLMs compete against each other in a
            turn-based, text-only version of <em>Among Us</em>. Watch games live, review past games, and
            learn how language models exhibit deception,  persuasion, and social reasoning.
          </p>
        </div>
      </div>

      {/* Season selector */}
      <SeasonSelector
        seasons={seasons}
        selectedVersion={selectedSeason}
        onSeasonChange={setSelectedSeason}
      />

      {/* Stats banner */}
      <StatsBar selectedSeason={selectedSeason} seasonGameCount={selectedSeasonGameCount} />

      {/* Leaderboard */}
      <Leaderboard selectedSeason={selectedSeason} />
    </PageLayout>
  );
}
```

Key changes:
- Uses `useSeasons` hook instead of `useState` for season state
- Removed `useGames` import — game count comes from `selectedSeasonGameCount`
- StatsBar filters by `impostor_games > 0` / `crewmate_games > 0` for top role stats
- StatsBar uses `models.length` instead of `data?.total` for "Models Ranked"
- All stat labels have `— S{n}` suffix
- Shows loading state while `useSeasons` resolves (prevents null-season flash)
- SeasonSelector rendered at page level (not inside Leaderboard)
- `getSeasonSuffix` helper for label suffix

- [ ] **Step 2: Run type-check**

Run: `cd frontend && bun run type-check`
Expected: PASS (all types should align now)

- [ ] **Step 3: Run all existing tests**

Run: `cd frontend && bun run test`
Expected: Some StatsBar tests may fail due to changed component structure (useSeasons hook now required). This is expected — tests will be updated in Task 6.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/app/page.tsx && git commit -m "fix: wire useSeasons hook, fix StatsBar filtering bugs, add season suffixes"
```

---

### Task 5: Route Restructure — Move Leaderboard to /leaderboard

**Files:**
- Create: `frontend/src/app/leaderboard/page.tsx`
- Modify: `frontend/src/app/page.tsx` (will become placeholder, then chart in Chunk 2)
- Modify: `frontend/src/components/layout/PageLayout.tsx`

- [ ] **Step 1: Create the leaderboard route**

Copy the current `page.tsx` (after Task 4 changes) to the leaderboard route:

```bash
mkdir -p frontend/src/app/leaderboard
cp frontend/src/app/page.tsx frontend/src/app/leaderboard/page.tsx
```

Then update `frontend/src/app/leaderboard/page.tsx`:
- Change `activePage="/"` to `activePage="/leaderboard"`
- Change function name from `Home` to `LeaderboardPage`

- [ ] **Step 2: Create placeholder home page**

Replace `frontend/src/app/page.tsx` with a temporary placeholder (will become chart page in Chunk 2):

```typescript
// frontend/src/app/page.tsx
'use client';

import { PageLayout } from '../components/layout/PageLayout';
import { useSeasons } from '../lib/hooks/useSeasons';
import { SeasonSelector } from '../components/features/SeasonSelector';

export default function Home() {
  const { seasons, selectedSeason, isLoading, setSelectedSeason, selectedSeasonGameCount } = useSeasons();

  if (isLoading) {
    return (
      <PageLayout activePage="/">
        <div className="flex items-center justify-center p-12">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePage="/">
      <SeasonSelector
        seasons={seasons}
        selectedVersion={selectedSeason}
        onSeasonChange={setSelectedSeason}
      />
      <div className="rounded-xl bg-white p-8 shadow-sm dark:bg-gray-900">
        <p className="text-center text-gray-500 dark:text-gray-400">
          Chart page coming soon — Games Played: {selectedSeasonGameCount}
        </p>
      </div>
    </PageLayout>
  );
}
```

- [ ] **Step 3: Update PageLayout nav links**

In `frontend/src/components/layout/PageLayout.tsx`, update the `navLinks` array (line 32-36):

```typescript
  const navLinks = [
    { href: '/about', label: 'About' },
    { href: '/games', label: 'View Games' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ];
```

Update the footer Leaderboard link (line 163-164). Change:
```typescript
              <Link
                href="/"
                onClick={() => handleFooterNavClick('/', 'Leaderboard')}
```
to:
```typescript
              <Link
                href="/leaderboard"
                onClick={() => handleFooterNavClick('/leaderboard', 'Leaderboard')}
```

- [ ] **Step 4: Run type-check**

Run: `cd frontend && bun run type-check`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `cd frontend && bun run lint`
Expected: PASS (or fix any lint issues)

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/app/page.tsx src/app/leaderboard/page.tsx src/components/layout/PageLayout.tsx && git commit -m "refactor: move leaderboard to /leaderboard, update nav links"
```

---

### Task 5b: Fix Game Detail Page Header

**Files:**
- Modify: `frontend/src/app/games/[id]/page.tsx`

The game detail page has its own custom `<header>` (lines 737-786) instead of using `PageLayout`. It shows "Game Log" as the `<h1>` in the header instead of "LM Deception Arena", and has hardcoded nav links pointing to `/` for Leaderboard.

- [ ] **Step 1: Refactor to use PageLayout**

Replace the custom header + main wrapper (lines 734-789) with `PageLayout`. Move the "Game Log" title, LIVE badge, and game ID into the content area.

At the top of the file, add the import:
```typescript
import { PageLayout } from '@/components/layout/PageLayout';
```

Remove the `Link` import if it's no longer used directly (check — it may still be used elsewhere in the component).

Replace the return statement's outer structure. Change from:
```typescript
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="border-b ...">
        ...custom header with "Game Log" title...
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        ...content...
      </main>
    </div>
  );
```

To:
```typescript
  return (
    <PageLayout activePage="/games" maxWidth="4xl" showFooter={false}>
      {/* Game Log title + LIVE badge (moved from header to content) */}
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Game Log
        </h2>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            LIVE
          </span>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
          {gameId}
        </p>
      </div>

      ...rest of content (everything that was inside <main>)...
    </PageLayout>
  );
```

Note: `showFooter={false}` preserves the current behavior (game detail page has no footer). Use `maxWidth="4xl"` to match the current `max-w-4xl` on the main element. The `activePage="/games"` highlights "View Games" in the nav.

- [ ] **Step 2: Remove unused imports**

Remove the `Link` import from `next/link` ONLY IF no other part of the component uses it. (Check the rest of the file — there may be Link usage in the game summary or chat sections.)

- [ ] **Step 3: Run type-check**

Run: `cd frontend && bun run type-check`
Expected: PASS

- [ ] **Step 4: Run build**

Run: `cd frontend && bun run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/app/games/\\[id\\]/page.tsx && git commit -m "refactor: use PageLayout in game detail page, move Game Log title to content"
```

---

### Task 6: Update Existing Tests

**Files:**
- Modify: `frontend/__tests__/components/StatsBar.test.tsx`

- [ ] **Step 1: Rewrite StatsBar tests for new architecture**

The tests need significant changes:
- Import from `@/app/leaderboard/page` instead of `@/app/page`
- Mock `@/lib/hooks/useSeasons` instead of `fetchSeasons`
- Remove `useGames` mock (no longer used by StatsBar)
- Update assertions for season suffix labels

```typescript
// frontend/__tests__/components/StatsBar.test.tsx
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

// Mock hooks
vi.mock('@/lib/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}));

vi.mock('@/lib/hooks/useSeasons', () => ({
  useSeasons: vi.fn(),
}));

import { useRankings } from '@/lib/hooks/useRankings';
import { useSeasons } from '@/lib/hooks/useSeasons';

// Import the leaderboard page component (StatsBar lives here now)
import LeaderboardPage from '@/app/leaderboard/page';

const defaultUseSeasons = {
  seasons: [
    { version: 1, label: 'Season 1 — Long Context', game_count: 42 },
    { version: 0, label: 'Season 0 — Skip Vote', game_count: 10 },
  ],
  selectedSeason: 1,
  selectedSeasonLabel: 'Season 1 — Long Context',
  selectedSeasonGameCount: 42,
  isLoading: false,
  setSelectedSeason: vi.fn(),
};

describe('StatsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSeasons).mockReturnValue(defaultUseSeasons);
  });

  it('displays game count from season data (not from fetched games)', async () => {
    vi.mocked(useRankings).mockReturnValue({
      data: {
        data: [
          { model_id: 'm1', model_name: 'Model 1', provider: 'Test', avatar_color: '#FF0000', impostor_rating: 2600, crewmate_rating: 2400, overall_rating: 2500, overall_sigma: 200, impostor_sigma: 250, crewmate_sigma: 180, games_played: 10, current_rank: 1, impostor_games: 5, impostor_wins: 3, crewmate_games: 5, crewmate_wins: 2, win_rate: 50, impostor_win_rate: 60, crewmate_win_rate: 40, release_date: '2025-01-01' },
        ],
        total: 1, page: 1, per_page: 100, total_pages: 1,
      },
      isLoading: false, error: null, refetch: vi.fn().mockResolvedValue(undefined),
    });

    render(<LeaderboardPage />);

    await waitFor(() => {
      // Games Played should show 42 (from season.game_count), not from useGames
      expect(screen.getByText('42')).toBeDefined();
      expect(screen.getByText(/Games Played — S1/)).toBeDefined();
    });
  });

  it('displays models.length for Models Ranked (not data.total)', async () => {
    vi.mocked(useRankings).mockReturnValue({
      data: {
        data: [
          { model_id: 'm1', model_name: 'Model 1', provider: 'Test', avatar_color: '#FF0000', impostor_rating: 2600, crewmate_rating: 2400, overall_rating: 2500, overall_sigma: 200, impostor_sigma: 250, crewmate_sigma: 180, games_played: 10, current_rank: 1, impostor_games: 5, impostor_wins: 3, crewmate_games: 5, crewmate_wins: 2, win_rate: 50, impostor_win_rate: 60, crewmate_win_rate: 40, release_date: '2025-01-01' },
          { model_id: 'm2', model_name: 'Model 2', provider: 'Test', avatar_color: '#00FF00', impostor_rating: 2500, crewmate_rating: 2550, overall_rating: 2525, overall_sigma: 210, impostor_sigma: 260, crewmate_sigma: 190, games_played: 8, current_rank: 2, impostor_games: 4, impostor_wins: 2, crewmate_games: 4, crewmate_wins: 2, win_rate: 50, impostor_win_rate: 50, crewmate_win_rate: 50, release_date: '2025-01-01' },
        ],
        total: 99, // intentionally different from data.data.length
        page: 1, per_page: 100, total_pages: 1,
      },
      isLoading: false, error: null, refetch: vi.fn().mockResolvedValue(undefined),
    });

    render(<LeaderboardPage />);

    await waitFor(() => {
      // Should show 2 (array length), NOT 99 (data.total)
      expect(screen.getByText('2')).toBeDefined();
      expect(screen.getByText(/Models Ranked — S1/)).toBeDefined();
    });
  });

  it('filters top impostor by impostor_games > 0', async () => {
    vi.mocked(useRankings).mockReturnValue({
      data: {
        data: [
          // High impostor rating but 0 impostor games — should NOT be selected
          { model_id: 'm1', model_name: 'NoImpostorGames', provider: 'Test', avatar_color: '#FF0000', impostor_rating: 9999, crewmate_rating: 2400, overall_rating: 2500, overall_sigma: 200, impostor_sigma: 100, crewmate_sigma: 180, games_played: 5, current_rank: 1, impostor_games: 0, impostor_wins: 0, crewmate_games: 5, crewmate_wins: 2, win_rate: 40, impostor_win_rate: 0, crewmate_win_rate: 40, release_date: '2025-01-01' },
          // Lower impostor rating but has impostor games — should be selected
          { model_id: 'm2', model_name: 'HasImpostorGames', provider: 'Test', avatar_color: '#00FF00', impostor_rating: 2600, crewmate_rating: 2400, overall_rating: 2500, overall_sigma: 200, impostor_sigma: 250, crewmate_sigma: 180, games_played: 10, current_rank: 2, impostor_games: 5, impostor_wins: 3, crewmate_games: 5, crewmate_wins: 2, win_rate: 50, impostor_win_rate: 60, crewmate_win_rate: 40, release_date: '2025-01-01' },
        ],
        total: 2, page: 1, per_page: 100, total_pages: 1,
      },
      isLoading: false, error: null, refetch: vi.fn().mockResolvedValue(undefined),
    });

    render(<LeaderboardPage />);

    await waitFor(() => {
      // Should show HasImpostorGames, NOT NoImpostorGames
      const redTexts = screen.getAllByText('HasImpostorGames');
      expect(redTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays season suffix on all stat labels', async () => {
    vi.mocked(useRankings).mockReturnValue({
      data: { data: [], total: 0, page: 1, per_page: 100, total_pages: 0 },
      isLoading: false, error: null, refetch: vi.fn().mockResolvedValue(undefined),
    });

    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Models Ranked — S1/)).toBeDefined();
      expect(screen.getByText(/Games Played — S1/)).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && bun run test`
Expected: All tests PASS

- [ ] **Step 3: Run full CI checks**

Run: `cd frontend && bun run type-check && bun run lint && bun run build`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
cd frontend && git add __tests__/components/StatsBar.test.tsx && git commit -m "test: update StatsBar tests for useSeasons hook and route change"
```

---

## Chunk 2: Chart Home Page (Phase 3 + Phase 4)

### Task 7: Install Plotly Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install plotly packages**

Run: `cd frontend && bun add plotly.js-basic-dist-min react-plotly.js && bun add -d @types/react-plotly.js`

- [ ] **Step 2: Verify installation**

Run: `cd frontend && bun run type-check`
Expected: PASS (no new type errors)

- [ ] **Step 3: Commit**

```bash
cd frontend && git add package.json bun.lock && git commit -m "deps: add plotly.js-basic-dist-min and react-plotly.js"
```

---

### Task 8: Create RatingChart Component

**Files:**
- Create: `frontend/src/components/features/RatingChart.tsx`

- [ ] **Step 1: Write the RatingChart component**

```typescript
// frontend/src/components/features/RatingChart.tsx
'use client';

import createPlotlyComponent from 'react-plotly.js/factory';
// @ts-expect-error — plotly.js-basic-dist-min has no type declarations
import Plotly from 'plotly.js-basic-dist-min';
import type { ModelRanking } from '../../types/leaderboard';

const Plot = createPlotlyComponent(Plotly);

const MAX_CHART_MODELS = 15;

interface RatingChartProps {
  models: ModelRanking[];
}

export function RatingChart({ models }: RatingChartProps) {
  // Take top N models sorted by overall rating (already sorted from API)
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
      default: // Overall
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
      orientation: 'h' as const,
      yanchor: 'bottom' as const,
      y: 1.02,
      xanchor: 'center' as const,
      x: 0.5,
      font: { color: '#94a3b8' },
    },
    margin: { l: 60, r: 20, t: 40, b: 80 },
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
```

- [ ] **Step 2: Run type-check**

Run: `cd frontend && bun run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/features/RatingChart.tsx && git commit -m "feat: add RatingChart component with Plotly grouped bar chart"
```

---

### Task 9: Build the Chart Home Page

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Replace placeholder with chart page**

```typescript
// frontend/src/app/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { PageLayout } from '../components/layout/PageLayout';
import { SeasonSelector } from '../components/features/SeasonSelector';
import { useSeasons } from '../lib/hooks/useSeasons';
import { useRankings } from '../lib/hooks/useRankings';

function getSeasonSuffix(selectedSeason: number): string {
  return `S${selectedSeason}`;
}

const RatingChart = dynamic(
  () => import('../components/features/RatingChart').then((mod) => ({ default: mod.RatingChart })),
  { ssr: false, loading: () => <div className="h-[500px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> }
);

export default function Home() {
  const { seasons, selectedSeason, isLoading, setSelectedSeason, selectedSeasonGameCount } = useSeasons();
  const { data } = useRankings(1, 100, isLoading ? undefined : selectedSeason);

  if (isLoading) {
    return (
      <PageLayout activePage="/">
        <div className="flex items-center justify-center p-12">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </PageLayout>
    );
  }

  const suffix = getSeasonSuffix(selectedSeason);
  const models = data?.data ?? [];

  return (
    <PageLayout activePage="/">
      {/* Season selector */}
      <SeasonSelector
        seasons={seasons}
        selectedVersion={selectedSeason}
        onSeasonChange={setSelectedSeason}
      />

      {/* Games played stat */}
      <div className="mb-6">
        <div className="inline-block rounded-xl bg-white px-5 py-3 shadow-sm dark:bg-gray-900">
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {selectedSeasonGameCount.toLocaleString()}
          </span>
          <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
            Games Played — {suffix}
          </span>
        </div>
      </div>

      {/* Rating chart */}
      <RatingChart models={models} />
    </PageLayout>
  );
}
```

Key implementation details:
- `RatingChart` is dynamically imported with `ssr: false` (Plotly needs `window`)
- Shows loading skeleton while Plotly loads
- `useRankings` is called with `undefined` engineVersion while seasons are loading to avoid premature API calls
- Single stat line shows game count with season suffix
- No about blurb (lives on `/leaderboard` now)

- [ ] **Step 2: Run type-check**

Run: `cd frontend && bun run type-check`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `cd frontend && bun run build`
Expected: PASS. Plotly is dynamically imported so it should be code-split properly.

- [ ] **Step 4: Run all tests**

Run: `cd frontend && bun run test`
Expected: All PASS

- [ ] **Step 5: Run lint and format**

Run: `cd frontend && bun run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/app/page.tsx && git commit -m "feat: chart-based home page with Plotly ratings visualization"
```

---

### Task 10: Final CI Verification

- [ ] **Step 1: Run full CI suite**

```bash
cd frontend && bun run type-check && bun run lint && bun run build && bun run test
```

Expected: All PASS

- [ ] **Step 2: Run backend CI too (shouldn't be affected)**

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest -v
```

Expected: All PASS (no backend changes)

- [ ] **Step 3: Final commit if any formatting/lint fixes were needed**

```bash
cd frontend && git add -A && git commit -m "chore: lint and format fixes"
```

Only run this if the lint/format step required changes.
