#!/usr/bin/env python3
"""
Run multiple games with balanced model participation.

Each model participates roughly the same number of times across all games.

Usage:
    # Set your API key first
    export OPENROUTER_API_KEY="sk-or-v1-..."

    # Run 10 games (default)
    python -m scripts.run_games

    # Run custom number of games
    python -m scripts.run_games --games 5

    # Skip confirmation prompt (useful for CI/CD)
    python -m scripts.run_games --games 5 --yes

    # Dry run (show games without triggering)
    python -m scripts.run_games --dry-run
"""

import argparse
import os
import random
import sys
import time
from collections import Counter

import httpx

# All registered models except kimi-k2.5 (unstable)
MODELS = [
    "claude-haiku-4.5",
    "gemini-3-flash",
    "gemini-3-pro",
    "gpt-5-mini",
    "gpt-oss-20b",
    # "solar-pro-3",
    "mistral-large-2512",
    "kimi-k2.5",
    "llama-3.3-70b",
    "deepseek-r1",
    "qwen3-235b",
    "glm-4.7",
    "claude-sonnet-4.5",
    "gpt-oss-120b",
    "deepseek-v3.2",
    "llama-4-maverick",
    "llama-4-scout",
    "llama-3.1-405b",
    "qwen3-next-80b-thinking",
    "minimax-m2",
    "kimi-k2-thinking",
    "glm-4.7-flash",
    "gpt-5.2-chat",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
]

PLAYERS_PER_GAME = 7


def generate_balanced_games(num_games: int) -> list[list[str]]:
    """
    Generate game lineups where each model participates roughly equally.

    Returns a list of games, where each game is a list of 7 model IDs.
    """
    games = []
    model_counts = Counter()

    for _ in range(num_games):
        # Sort models by how many times they've played (least first)
        sorted_models = sorted(MODELS, key=lambda m: (model_counts[m], random.random()))

        # Pick the 7 least-played models
        game_models = sorted_models[:PLAYERS_PER_GAME]

        # Shuffle so roles are random
        random.shuffle(game_models)

        games.append(game_models)

        # Update counts
        for model in game_models:
            model_counts[model] += 1

    return games


def print_game_plan(games: list[list[str]]) -> None:
    """Print the planned games and participation stats."""
    print(f"\n{'=' * 60}")
    print(f"GAME PLAN: {len(games)} games")
    print(f"{'=' * 60}\n")

    for i, game in enumerate(games, 1):
        print(f"Game {i}: {', '.join(game)}")

    # Stats
    model_counts = Counter()
    for game in games:
        for model in game:
            model_counts[model] += 1

    print(f"\n{'=' * 60}")
    print("PARTICIPATION STATS")
    print(f"{'=' * 60}\n")

    for model, count in sorted(model_counts.items(), key=lambda x: -x[1]):
        bar = "█" * count
        print(f"{model:30} {count:2}x {bar}")

    total_slots = len(games) * PLAYERS_PER_GAME
    print(f"\nTotal model slots: {total_slots}")
    print(f"Models participating: {len(model_counts)}")
    print(f"Avg games per model: {total_slots / len(model_counts):.1f}")


def trigger_game(api_url: str, api_key: str, model_ids: list[str]) -> dict:
    """Trigger a single game via the API."""
    response = httpx.post(
        f"{api_url}/api/games/trigger",
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
        json={"model_ids": model_ids},
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()


def main():
    parser = argparse.ArgumentParser(description="Run multiple balanced games")
    parser.add_argument("--games", type=int, default=10, help="Number of games to run")
    parser.add_argument("--dry-run", action="store_true", help="Show plan without triggering")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--delay", type=int, default=5, help="Seconds between game triggers")
    parser.add_argument(
        "--api-url",
        default=os.environ.get("API_URL", "https://api.lmdeceptionarena.averyyen.dev"),
        help="API base URL",
    )
    args = parser.parse_args()

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key and not args.dry_run:
        print("ERROR: OPENROUTER_API_KEY environment variable required")
        print("  export OPENROUTER_API_KEY='sk-or-v1-...'")
        sys.exit(1)

    # Generate balanced game lineups
    games = generate_balanced_games(args.games)

    # Show the plan
    print_game_plan(games)

    if args.dry_run:
        print("\n[DRY RUN] No games triggered.")
        return

    # Confirm
    if not args.yes:
        print(f"\nReady to trigger {len(games)} games.")
        response = input("Proceed? [y/N] ").strip().lower()
        if response != "y":
            print("Aborted.")
            return

    # Trigger games
    print(f"\n{'=' * 60}")
    print("TRIGGERING GAMES")
    print(f"{'=' * 60}\n")

    triggered = []
    for i, game_models in enumerate(games, 1):
        print(f"Game {i}/{len(games)}: {game_models}", end="", flush=True)

        try:
            result = trigger_game(args.api_url, api_key, game_models)
            game_id = result.get("game_id", "unknown")
            print(f"✓ {game_id}")
            triggered.append(game_id)
        except httpx.HTTPStatusError as e:
            print(f"✗ HTTP {e.response.status_code}: {e.response.text[:100]}")
        except Exception as e:
            print(f"✗ {e}")

        if i < len(games):
            time.sleep(args.delay)

    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {len(triggered)}/{len(games)} games triggered")
    print(f"{'=' * 60}\n")

    if triggered:
        print("Game IDs:")
        for gid in triggered:
            print(f"  {gid}")
        print(f"\nMonitor at: {args.api_url}/api/games?limit={len(triggered)}")


if __name__ == "__main__":
    main()
