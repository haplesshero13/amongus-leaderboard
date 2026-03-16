# Chart-Based Home Page & Season Logic Consolidation

## Summary

Replace the current leaderboard table at `/` with a Plotly-based grouped vertical bar chart showing model ratings. Move the existing leaderboard table to `/leaderboard`. Fix and centralize the season filtering logic that both pages will share.

## Motivation

The chart provides an at-a-glance visual comparison of model performance — overall, impostor, and crewmate ratings with uncertainty bars. The current table view becomes a drill-down for users who want the full ranked list. Along the way, the existing season filtering logic has bugs (models with 0 games shown, stats computed from unfiltered data) that need fixing before building on top of it.

## Implementation Order

The work is ordered to fix the foundation before building new features:

1. **Phase 1**: Centralize and fix season/rating logic
2. **Phase 2**: Route restructure (`/` → `/leaderboard`)
3. **Phase 3**: New chart home page
4. **Phase 4**: Stat line label improvements

---

## Phase 1: Centralize Season Logic

### Problem

Season-related state and filtering is scattered across multiple components with bugs:

- **`page.tsx` (Home)**: Owns `selectedSeason` state, passes it down to `StatsBar` and `Leaderboard`
- **`SeasonSelector.tsx`**: Fetches seasons, auto-selects latest, but has missing `onSeasonChange` in useEffect dependency array
- **`StatsBar` (inline in page.tsx)**: Computes top impostor/crewmate from ALL models, including those with 0 games in the selected season
- **`Leaderboard.tsx`**: Displays all models from API response without filtering out 0-game models
- **Initial render**: `selectedSeason` starts as `null`, causing a flash of wrong data before SeasonSelector auto-selects

### Solution

Create a `useSeasons` hook that centralizes:

1. Fetching available seasons
2. Managing selected season state (with default = latest season)
3. Providing the season label for display

**File**: `frontend/src/lib/hooks/useSeasons.ts`

```typescript
interface UseSeasonsReturn {
  seasons: Season[];
  selectedSeason: number;             // always a valid season version
  selectedSeasonLabel: string | null;
  selectedSeasonGameCount: number;    // game_count for the selected season
  isLoading: boolean;
  setSelectedSeason: (version: number) => void;
}
```

Behavior:
- On mount, fetches seasons and auto-selects the latest (highest version)
- `isLoading` is true until seasons are fetched AND default is selected — consumers should not render data until this is `false`, preventing the null-season flash
- `selectedSeason` is always a valid season version number (never null). There is no "All Seasons" option — the backend's `/api/leaderboard` endpoint defaults to `CURRENT_ENGINE_VERSION` when no `engine_version` is provided and has no cross-season aggregation support. Adding "All Seasons" would require backend changes and is out of scope.
- Label is derived from the seasons list (e.g., version 1 → "S1")
- `selectedSeasonGameCount` provides the `game_count` for the selected season, sourced from the fetched seasons data, avoiding extra API calls

### Bug Fixes in Phase 1

1. **Filter 0-game models**: The backend's `get_historical_rankings` already filters out models with 0 total games. However, when computing role-specific stats (top impostor, top crewmate), a model may have overall games but 0 games in a specific role. The fix is twofold: (a) verify the backend filtering is working correctly for the leaderboard endpoint, and (b) in the StatsBar, filter by role-specific game counts when computing top impostor/crewmate (see bug fix #2). The "Models Ranked" stat in StatsBar must use `data.data.length` (the filtered array) rather than `data.total` (the unfiltered pagination count from the API).
2. **StatsBar top impostor/crewmate**: Compute only from models with `impostor_games > 0` and `crewmate_games > 0` respectively
3. **SeasonSelector dependency**: Fix by moving season state into the `useSeasons` hook — SeasonSelector becomes a pure controlled component receiving `seasons`, `selectedSeason`, and `onSelect` from the parent via the hook
4. **SeasonSelector loading state**: When `useSeasons.isLoading` is true, the SeasonSelector is not rendered (current behavior preserved — it returns `null` during loading). The existing behavior of hiding when there is only 1 season is also preserved — with no "All Seasons" option, a single season means there's nothing to toggle.

### Affected Files

- New: `frontend/src/lib/hooks/useSeasons.ts`
- Modified: `frontend/src/components/features/SeasonSelector.tsx` — becomes a controlled component receiving seasons + selectedSeason from hook
- Modified: `frontend/src/app/page.tsx` — uses `useSeasons` hook instead of inline state
- Modified: `frontend/src/app/page.tsx` — StatsBar uses `data.data.length` for "Models Ranked", filters by role-specific games for top impostor/crewmate
- Modified: `frontend/src/components/features/Leaderboard.tsx` — receives selectedSeason from parent, no longer owns season change handler internally

---

## Phase 2: Route Restructure

### Changes

| Before | After |
|--------|-------|
| `/` → Leaderboard table | `/` → Chart page (Phase 3) |
| N/A | `/leaderboard` → Leaderboard table |

### Implementation

1. Move `frontend/src/app/page.tsx` content → `frontend/src/app/leaderboard/page.tsx`
   - The "About" blurb (the `<div>` with "LM Deception Arena" heading and description text) moves to the leaderboard page along with StatsBar and the table. It stays as introductory context above the leaderboard. The new chart home page does not include this blurb.
2. Create new `frontend/src/app/page.tsx` (placeholder until Phase 3)
3. Update `PageLayout.tsx` navigation (both header AND footer):
   - **Header**: Site title ("LM Deception Arena") links to `/`. Nav links: **Leaderboard** (`/leaderboard`), **View Games** (`/games`), **About** (`/about`). No separate "Home" nav link — the site title/logo is the home link (standard web pattern).
   - **Footer**: Update the "Leaderboard" link from `/` to `/leaderboard`. Other footer links ("Games", "About") remain unchanged.
4. Update `activePage` logic for the new routes. The chart home page does not highlight any nav link (only the site title is the link to `/`).
5. Fix the game detail page (`frontend/src/app/games/[id]/page.tsx`) — it has a custom header that shows "Game Log" as the `<h1>` instead of "LM Deception Arena". The site title in the header must always be "LM Deception Arena" on every page. Page-specific titles like "Game Log" and the LIVE badge belong in the content area, not the header. This page also has hardcoded nav links that need updating (`/` → `/leaderboard` for the Leaderboard link). Refactor this page to use `PageLayout` so the header is consistent everywhere.

### Nav Structure

```
[👽 LM Deception Arena (→ /)]    [Leaderboard (/leaderboard)]  [View Games (/games)]  [About (/about)]
```

### Test Impact

The following test files import from `@/app/page` and will need updating:
- `frontend/__tests__/components/StatsBar.test.tsx` — imports `Home` from `@/app/page`. After the move, this import changes to `@/app/leaderboard/page`. The test assertions remain the same since the leaderboard page keeps the StatsBar.

---

## Phase 3: Chart Home Page

### New Page: `frontend/src/app/page.tsx`

**Layout (top to bottom):**

1. **Season selector** — reuses the centralized `useSeasons` hook + `SeasonSelector` component
2. **Stat line** — single metric: "Games Played — S1" (or "— S0"). The game count is read from `useSeasons`'s `selectedSeasonGameCount`, avoiding an extra API call to fetch game objects.
3. **Plotly grouped vertical bar chart** — extracted into a standalone component `frontend/src/components/features/RatingChart.tsx` for testability, then dynamically imported into the page with `next/dynamic` + `ssr: false`

### Chart Specification

**Library**: `plotly.js-basic-dist-min` + `react-plotly.js`. Using the basic minified distribution (~1MB) instead of the full `plotly.js` (~3.5MB) since only bar charts are needed.

**Chart type**: Grouped bar chart (`type: 'bar'`, `barmode: 'group'`)

**Data**: Top 15 models by overall rating from the selected season (`MAX_CHART_MODELS = 15`). Only models with `games_played >= 1` (already filtered by `useRankings`).

**Three traces (bar groups per model):**

| Trace | Color | Error Bar |
|-------|-------|-----------|
| Overall | `#6366f1` (indigo) | ± `overall_sigma` |
| Impostor | `#ef4444` (red) | ± `impostor_sigma` |
| Crewmate | `#06b6d4` (cyan) | ± `crewmate_sigma` |

**Axes:**
- X-axis: Model names (sorted by overall rating descending, left-to-right)
- Y-axis: Rating (mu × 100)

**Hover tooltip** (custom `hovertemplate`):
```
claude-sonnet-4.6 — Overall
Rating: 2,764 ± 412
Record: 8W - 4L (66.7%)
```

The tooltip shows:
- Model name + role
- Exact rating ± sigma (uncertainty)
- Win-loss record and win rate for that role

**W-L record derivation by trace:**
- **Impostor trace**: `impostor_wins` W - `(impostor_games - impostor_wins)` L, `impostor_win_rate`%
- **Crewmate trace**: `crewmate_wins` W - `(crewmate_games - crewmate_wins)` L, `crewmate_win_rate`%
- **Overall trace**: `(impostor_wins + crewmate_wins)` W - `(games_played - impostor_wins - crewmate_wins)` L, `win_rate`%

**Plotly layout config:**
- Dark theme matching site (paper/plot bgcolor transparent or dark)
- White/light gray axis text
- Legend at top
- Responsive sizing
- `config: { displayModeBar: false }` for clean look

**Responsive behavior**: The chart fills the available width. Models are not scrollable — only the top 15 are shown. The full list lives at `/leaderboard`.

### Dependencies to Add

```bash
bun add plotly.js-basic-dist-min react-plotly.js
bun add -d @types/react-plotly.js
```

**Dynamic import**: Use `next/dynamic` with `ssr: false` to import the `RatingChart` component in `page.tsx`, since Plotly requires the `window` object and cannot be server-rendered.

### New Files

- `frontend/src/components/features/RatingChart.tsx` — standalone Plotly chart component. Receives `models: ModelRanking[]` as props, handles trace construction, layout, and hover template internally.

---

## Phase 4: Stat Line Labels

### Chart Page (new `/`)

Single stat: **"Games Played — S1"** (or "S0")

- Game count sourced from `selectedSeasonGameCount` in the `useSeasons` hook

### Leaderboard Page (`/leaderboard`)

Four stats, each with season suffix:

| Stat | Format |
|------|--------|
| Models Ranked | "Models Ranked — S1" |
| Games Played | "Games Played — S1" |
| Top Impostor | "Top Impostor (Rating) — S1" |
| Top Crewmate | "Top Crewmate (Rating) — S1" |

The suffix is "S0", "S1", etc. derived from the season version number.

A helper function `getSeasonSuffix(selectedSeason: number): string` returns the appropriate suffix string (e.g., `"S1"`).

---

## Backend

No backend changes required. The existing endpoints already provide all needed data:
- `GET /api/leaderboard?engine_version={v}` — returns model rankings with ratings, sigma, games, wins
- `GET /api/seasons` — returns available seasons with `game_count`
- `GET /api/games?engine_version={v}&status=completed` — returns game data (used by games page, not needed for stats on chart or leaderboard pages)

Note: Both the chart page and leaderboard page should use `season.game_count` from the `useSeasons` hook for the "Games Played" stat, rather than fetching game objects via `useGames` and counting them. This eliminates an unnecessary API call that currently fetches up to 1000 game objects just to get a count.

---

## Testing

### Tests Requiring Updates

| Test File | Change Needed |
|-----------|---------------|
| `__tests__/components/StatsBar.test.tsx` | Update import from `@/app/page` to `@/app/leaderboard/page` |
| `__tests__/components/LeaderboardTable.test.tsx` | No change (imports component directly) |
| `__tests__/components/LeaderboardCards.test.tsx` | No change (imports component directly) |

### New Test Coverage

- **`useSeasons` hook**: Verify auto-selects latest season, `isLoading` transitions, `setSelectedSeason` works
- **StatsBar filtering**: Verify "Models Ranked" uses filtered array length, top impostor/crewmate only considers models with role-specific games > 0
- **Chart page**: Verify chart renders with Plotly (may need to mock `react-plotly.js`), season selector present, stat line shows correct label
- **Navigation**: Verify site title links to `/`, Leaderboard link goes to `/leaderboard`
- **Stat labels**: Verify season suffix appears on all stat labels
