#!/usr/bin/env python3
"""
Fix participant colors for existing games.

The original game_runner.py pre-assigned colors before the game ran,
but amongagents assigns its own colors. This script reads the actual
colors from the stored S3 logs and updates the database.

Usage:
    cd backend
    uv run python -m scripts.fix_participant_colors
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal, init_db
from app.models import Game, GameParticipant, GameStatus
from app.services.storage_service import get_game_logs


def fix_colors_for_game(db, game: Game) -> tuple[int, int]:
    """
    Fix participant colors for a single game.

    Returns (updated_count, skipped_count)
    """
    if not game.log_bucket or not game.log_key:
        return 0, len(game.participants)

    # Fetch logs from S3
    log_data = get_game_logs(game.log_bucket, game.log_key)
    if not log_data:
        print(f"  Could not fetch logs for game {game.id}")
        return 0, len(game.participants)

    summary = log_data.get("summary", {})
    if not summary:
        print(f"  No summary in logs for game {game.id}")
        return 0, len(game.participants)

    updated = 0
    skipped = 0

    for participant in game.participants:
        player_key = f"Player {participant.player_number}"
        player_data = summary.get(player_key)

        if not player_data:
            print(f"  No data for {player_key} in game {game.id}")
            skipped += 1
            continue

        actual_color = player_data.get("color")
        if not actual_color:
            print(f"  No color for {player_key} in game {game.id}")
            skipped += 1
            continue

        if participant.player_color != actual_color:
            print(f"  {player_key}: {participant.player_color} -> {actual_color}")
            participant.player_color = actual_color
            updated += 1
        else:
            skipped += 1

    return updated, skipped


def main():
    print("=== Fix Participant Colors Migration ===\n")

    init_db()
    db = SessionLocal()

    try:
        # Get all completed games
        games = (
            db.query(Game)
            .filter(
                Game.status == GameStatus.COMPLETED,
                Game.log_bucket.isnot(None),
                Game.log_key.isnot(None),
            )
            .all()
        )

        print(f"Found {len(games)} completed games with logs\n")

        total_updated = 0
        total_skipped = 0
        games_modified = 0

        for game in games:
            print(f"Processing game {game.id}...")
            updated, skipped = fix_colors_for_game(db, game)

            if updated > 0:
                games_modified += 1

            total_updated += updated
            total_skipped += skipped

        if total_updated > 0:
            print(f"\nCommitting {total_updated} color updates across {games_modified} games...")
            db.commit()
            print("Done!")
        else:
            print("\nNo updates needed.")

        print(f"\nSummary:")
        print(f"  Games processed: {len(games)}")
        print(f"  Games modified: {games_modified}")
        print(f"  Participants updated: {total_updated}")
        print(f"  Participants unchanged: {total_skipped}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
