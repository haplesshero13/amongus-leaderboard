# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the LM Deception Arena frontend. The integration uses Next.js 15.3+ best practices with `instrumentation-client.ts` for client-side initialization, includes a reverse proxy configuration for improved tracking reliability, and captures key user interactions across all pages.

## Changes Made

### Core Setup Files
- **`instrumentation-client.ts`** - PostHog client-side initialization using the modern Next.js 15.3+ approach
- **`next.config.ts`** - Added reverse proxy rewrites for PostHog ingestion to avoid ad blockers
- **`.env.local`** - Environment variables for PostHog API key and host

### Event Tracking Implementation

| Event Name | Description | File |
|------------|-------------|------|
| `model_clicked` | User clicked on a model row in the desktop leaderboard table | `src/components/features/LeaderboardTable.tsx` |
| `model_card_clicked` | User clicked on a model card in the mobile leaderboard view | `src/components/features/LeaderboardCards.tsx` |
| `leaderboard_page_changed` | User navigated to a different page in the leaderboard pagination | `src/components/features/Leaderboard.tsx` |
| `game_card_clicked` | User clicked on a game card to view game details | `src/app/games/page.tsx` |
| `game_filter_applied` | User applied/modified a model filter on the games list | `src/app/games/page.tsx` |
| `game_filter_cleared` | User cleared all filters on the games list | `src/app/games/page.tsx` |
| `game_step_filter_changed` | User changed the step filter when viewing game replay | `src/app/games/[id]/page.tsx` |
| `thinking_visibility_toggled` | User toggled the visibility of AI thinking/memory sections | `src/app/games/[id]/page.tsx` |
| `external_link_clicked` | User clicked on an external link (papers, GitHub repos) | `src/app/about/page.tsx`, `src/components/layout/PageLayout.tsx` |
| `navigation_clicked` | User clicked on a navigation link in header or footer | `src/components/layout/PageLayout.tsx` |

### Event Properties

Each event includes relevant contextual properties:
- **Model events**: `model_id`, `model_name`, `provider`, `current_rank`, `overall_rating`, `games_played`
- **Game events**: `game_id`, `game_status`, `winner`, `impostor_models`, `crewmate_models`
- **Filter events**: `action` (added/removed/cleared), `model_id`, `model_name`, `total_filters`, `selected_models`
- **Navigation events**: `from_page`, `to_page`, `link_label`, `location` (header/footer)
- **External link events**: `url`, `link_text`, `link_type` (paper/github/documentation/service)

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/303102/dashboard/1187240) - Main analytics dashboard with all key metrics

### Insights
- [Model Clicks Over Time](https://us.posthog.com/project/303102/insights/1AmC8E4d) - Track how often users click on models in the leaderboard
- [Game Engagement Funnel](https://us.posthog.com/project/303102/insights/bY9FSYQb) - Track user journey from games list to game details
- [Navigation Patterns](https://us.posthog.com/project/303102/insights/aWD4IVR0) - Track which pages users navigate to
- [External Link Engagement](https://us.posthog.com/project/303102/insights/eLIeWPhT) - Track clicks on papers and GitHub links
- [Game Filtering Behavior](https://us.posthog.com/project/303102/insights/Evjp5Sdu) - Track how users filter games by models

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

## Technical Notes

- PostHog is initialized via `instrumentation-client.ts` which is the recommended approach for Next.js 15.3+
- Exception capturing is enabled for automatic error tracking
- Debug mode is enabled in development for easier testing
- Reverse proxy is configured to route through `/ingest` to avoid ad blockers
- Environment variables use `NEXT_PUBLIC_` prefix for client-side access
