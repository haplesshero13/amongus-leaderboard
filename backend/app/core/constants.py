"""Engine versioning constants for game seasons."""

# Bump this when the game engine changes significantly.
# All new games are tagged with this version.
CURRENT_ENGINE_VERSION = 0

# Maximum time (in seconds) for a single game execution before it's killed.
# A 7-player LLM game typically takes 30-60 minutes; 90 minutes is very generous.
GAME_TIMEOUT_SECONDS = 90 * 60

# Human-readable labels for each engine version / season.
SEASON_LABELS: dict[int, str] = {
    0: "Season 0 \u2014 Skip Vote",
    # 1: "Season 1 \u2014 Long Context (Future)",
}
