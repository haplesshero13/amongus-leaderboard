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
  selectedSeason: number | null;    // null = "All Seasons"
  selectedSeasonLabel: string | null;
  isLoading: boolean;
  setSelectedSeason: (version: number | null) => void;
}
```

Behavior:
- On mount, fetches seasons and auto-selects the latest (highest version)
- `isLoading` is true until seasons are fetched AND default is selected — consumers should not render data until this is `false`, preventing the null-season flash
- `setSelectedSeason(null)` means "All Seasons"
- Label is derived from the seasons list (e.g., version 1 → "S1")

### Bug Fixes in Phase 1

1. **Filter 0-game models**: Add a `useFilteredRankings` hook or filter in the existing `useRankings` return — models with `games_played === 0` in the selected season are excluded from all consumers
2. **StatsBar top impostor/crewmate**: Compute only from models with `impostor_games > 0` and `crewmate_games > 0` respectively
3. **SeasonSelector dependency**: Fix by moving season state into the `useSeasons` hook — SeasonSelector becomes a pure display component that calls `setSelectedSeason`

### Affected Files

- New: `frontend/src/lib/hooks/useSeasons.ts`
- Modified: `frontend/src/components/features/SeasonSelector.tsx` — becomes a controlled component receiving seasons + selectedSeason from hook
- Modified: `frontend/src/app/page.tsx` — uses `useSeasons` hook instead of inline state
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
2. Create new `frontend/src/app/page.tsx` (placeholder until Phase 3)
3. Update `PageLayout.tsx` navigation:
   - Site title ("LM Deception Arena") links to `/`
   - "Leaderboard" nav link changes from `/` to `/leaderboard`
   - Add "Home" or keep site title as the `/` link
4. Update `activePage` logic for the new routes

### Nav Structure

```
[👽 LM Deception Arena (→ /)]    [Home (/)]  [Leaderboard (/leaderboard)]  [View Games (/games)]  [About (/about)]
```

---

## Phase 3: Chart Home Page

### New Page: `frontend/src/app/page.tsx`

**Layout (top to bottom):**

1. **Season selector** — reuses the centralized `useSeasons` hook + `SeasonSelector` component
2. **Stat line** — single metric: "Games Played — S1" (or "— S0", "— All")
3. **Plotly grouped vertical bar chart**

### Chart Specification

**Library**: `react-plotly.js` + `plotly.js`

**Chart type**: Grouped bar chart (`type: 'bar'`, `barmode: 'group'`)

**Data**: Top N models by overall rating from the selected season, where N is capped to fit comfortably (~12-15 models). Only models with `games_played >= 1`.

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
- Win-loss record and win rate for that role (overall W-L for Overall trace)

**Plotly layout config:**
- Dark theme matching site (paper/plot bgcolor transparent or dark)
- White/light gray axis text
- Legend at top
- Responsive sizing
- `config: { displayModeBar: false }` for clean look

**Responsive behavior**: The chart fills the available width. Models are not scrollable — if there are more models than fit, only the top N are shown. The full list lives at `/leaderboard`.

### Dependencies to Add

```json
{
  "plotly.js": "^2.35.0",
  "react-plotly.js": "^2.6.0"
}
```

Plus `@types/react-plotly.js` as a dev dependency if needed.

**Dynamic import**: Use `next/dynamic` with `ssr: false` to import the Plotly component, since Plotly requires the `window` object and cannot be server-rendered.

---

## Phase 4: Stat Line Labels

### Chart Page (new `/`)

Single stat: **"Games Played — S1"** (or "S0", "All")

- Counts completed games in the selected season
- Uses data from `useGames` hook with season filter

### Leaderboard Page (`/leaderboard`)

Four stats, each with season suffix:

| Stat | Format |
|------|--------|
| Models Ranked | "Models Ranked — S1" |
| Games Played | "Games Played — S1" |
| Top Impostor | "Top Impostor (Rating) — S1" |
| Top Crewmate | "Top Crewmate (Rating) — S1" |

The suffix is:
- "S0", "S1", etc. for specific seasons (derived from version number)
- "All" when no season filter is applied

---

## Backend

No backend changes required. The existing endpoints already provide all needed data:
- `GET /api/leaderboard?engine_version={v}` — returns model rankings with ratings, sigma, games, wins
- `GET /api/seasons` — returns available seasons
- `GET /api/games?engine_version={v}&status=completed` — returns game counts

---

## Testing

- Existing frontend tests updated for route changes
- Verify season selector defaults to latest season
- Verify models with 0 games are not shown (chart or leaderboard)
- Verify stat labels show correct season suffix
- Verify chart renders with error bars and correct hover data
- Verify navigation links point to correct routes
