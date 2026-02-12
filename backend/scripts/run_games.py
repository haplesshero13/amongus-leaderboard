#!/usr/bin/env python3
"""
Run multiple games using server-side matchmaking.

Usage:
    # Set your API key first
    export OPENROUTER_API_KEY="sk-or-v1-..."

    # Run 10 games (default)
    python -m scripts.run_games

    # Run custom number of games
    python -m scripts.run_games --games 5

    # Run locally without API calls (requires database)
    python -m scripts.run_games --games 5 --mode direct

    # Skip confirmation prompt (useful for CI/CD)
    python -m scripts.run_games --games 5 --yes
"""

import argparse
import asyncio
import os
import sys
import time

import httpx


def trigger_matchmake(api_url: str, api_key: str) -> dict:
    """Trigger a single game via the matchmaking API."""
    response = httpx.post(
        f"{api_url}/api/games/matchmake",
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
        json={},  # Empty body
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()


def create_game_with_matchmaking() -> tuple[str, list[str]]:
    """Select participants, create a game record, and return (game_id, model_ids).

    Returns:
        tuple[str, list[str]]: Game ID and ordered model IDs.

    Raises:
        Exception: If matchmaking or database operations fail.
    """
    from app.core.constants import CURRENT_ENGINE_VERSION
    from app.core.database import SessionLocal
    from app.models import Game, GameStatus
    from app.services.matchmaking import select_participants

    db = SessionLocal()
    try:
        try:
            model_ids = select_participants(db)
        except Exception as e:
            raise RuntimeError(f"Failed to select participants: {e}") from e
        game = Game(
            status=GameStatus.PENDING,
            engine_version=CURRENT_ENGINE_VERSION,
            model_ids=model_ids,
        )
        try:
            db.add(game)
            db.commit()
        except Exception as e:
            db.rollback()
            raise RuntimeError(f"Failed to create game record: {e}") from e
        game_id = game.id
        return game_id, model_ids
    finally:
        db.close()


async def run_direct_games(num_games: int, delay: int) -> list[str]:
    """Run games directly through the game runner without HTTP.

    Args:
        num_games: Number of games to run.
        delay: Seconds to wait between game runs.

    Returns:
        list[str]: Game IDs for successfully completed runs.
    """
    from app.services.game_runner import run_game_async

    triggered = []
    for game_num in range(1, num_games + 1):
        print(f"Game {game_num}/{num_games}: Direct run...", end="", flush=True)

        try:
            game_id, model_ids = create_game_with_matchmaking()
        except Exception as e:
            print(f" ✗ Setup failed: {e}")
            continue

        try:
            await run_game_async(
                game_id, model_ids, randomize_roles=False, stream_logs=False
            )
            print(f" ✓ {game_id}")
            triggered.append(game_id)
        except Exception as e:
            print(f" ✗ Run failed: {e}")

        if game_num < num_games:
            await asyncio.sleep(delay)

    return triggered


def main():
    parser = argparse.ArgumentParser(description="Run multiple games with matchmaking")
    parser.add_argument("--games", type=int, default=10, help="Number of games to run")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually trigger")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--delay", type=int, default=5, help="Seconds between game triggers")
    parser.add_argument(
        "--mode",
        choices=["api", "direct"],
        default="api",
        help="Use API requests or run games directly (default: api)",
    )
    parser.add_argument(
        "--api-url",
        default=os.environ.get("API_URL", "https://api.lmdeceptionarena.averyyen.dev"),
        help="API base URL",
    )
    args = parser.parse_args()

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("ERROR: OPENROUTER_API_KEY environment variable required")
        sys.exit(1)

    print(f"\nPlan: Trigger {args.games} games via matchmaking ({args.mode} mode)")
    if args.mode == "api":
        print(f"URL: {args.api_url}/api/games/matchmake")
    else:
        print("Mode: direct (no HTTP calls, requires local database access)")

    if args.dry_run:
        print("\n[DRY RUN] No games triggered.")
        return

    # Confirm
    if not args.yes:
        response = input("Proceed? [y/N] ").strip().lower()
        if response != "y":
            print("Aborted.")
            return

    # Trigger games
    print(f"\n{'=' * 60}")
    print("TRIGGERING GAMES")
    print(f"{'=' * 60}\n")

    if args.mode == "api":
        triggered = []
        for i in range(1, args.games + 1):
            print(f"Game {i}/{args.games}: Matchmaking...", end="", flush=True)

            try:
                result = trigger_matchmake(args.api_url, api_key)
                game_id = result.get("game_id", "unknown")
                print(f" ✓ {game_id}")
                triggered.append(game_id)
            except httpx.HTTPStatusError as e:
                print(f" ✗ HTTP {e.response.status_code}: {e.response.text[:100]}")
            except Exception as e:
                print(f" ✗ {e}")

            if i < args.games:
                time.sleep(args.delay)
    else:
        triggered = asyncio.run(run_direct_games(args.games, args.delay))

    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {len(triggered)}/{args.games} games triggered")
    print(f"{'=' * 60}\n")

    if triggered:
        print("Game IDs:")
        for gid in triggered:
            print(f"  {gid}")
        print(f"\nMonitor at: {args.api_url}/api/games?limit={len(triggered)}")


if __name__ == "__main__":
    main()
