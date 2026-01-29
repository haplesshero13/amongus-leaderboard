#!/usr/bin/env python3
"""
Backfill win counts from existing completed games.

Run with: uv run python scripts/backfill_wins.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models import Game, GameStatus, PlayerRole
from app.services.rating_service import get_or_create_rating


def backfill_wins():
    """Calculate and backfill win counts from completed games."""
    db = SessionLocal()

    try:
        # Reset all win counts first
        from app.models import ModelRating

        db.query(ModelRating).update(
            {
                ModelRating.impostor_wins: 0,
                ModelRating.crewmate_wins: 0,
            }
        )
        db.flush()
        print("Reset all win counts to 0")

        # Get all completed games
        completed_games = (
            db.query(Game)
            .filter(Game.status == GameStatus.COMPLETED, Game.winner.isnot(None))
            .all()
        )

        print(f"Found {len(completed_games)} completed games to process")

        impostor_wins_added = 0
        crewmate_wins_added = 0

        for game in completed_games:
            impostors_won = game.impostors_won

            for participant in game.participants:
                rating = get_or_create_rating(db, participant.model)

                if participant.role == PlayerRole.IMPOSTOR:
                    if impostors_won:
                        rating.impostor_wins += 1
                        impostor_wins_added += 1
                else:  # Crewmate
                    if not impostors_won:
                        rating.crewmate_wins += 1
                        crewmate_wins_added += 1

        db.commit()
        print("\nBackfill complete!")
        print(f"  Impostor wins recorded: {impostor_wins_added}")
        print(f"  Crewmate wins recorded: {crewmate_wins_added}")

        # Print summary per model
        print("\nWin summary by model:")
        ratings = db.query(ModelRating).all()
        for r in ratings:
            model = r.model
            total_wins = r.impostor_wins + r.crewmate_wins
            total_games = r.total_games
            if total_games > 0:
                print(
                    f"  {model.model_id}: {total_wins}W-{total_games - total_wins}L "
                    f"(Imp: {r.impostor_wins}/{r.impostor_games}, Crew: {r.crewmate_wins}/{r.crewmate_games})"
                )

    finally:
        db.close()


if __name__ == "__main__":
    backfill_wins()
