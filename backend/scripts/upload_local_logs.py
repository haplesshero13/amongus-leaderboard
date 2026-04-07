#!/usr/bin/env python3
"""
Upload local amongagents logs to S3 storage and update database/ratings.

Usage:
    # Upload all games from a summary file
    python -m scripts.upload_local_logs /path/to/amongagents/logs/experiment_name

    # Upload only a specific game from the summary
    python -m scripts.upload_local_logs /path/to/logs --game-index 5

    # Upload with custom game ID prefix
    python -m scripts.upload_local_logs /path/to/logs --prefix batch1

    # Dry run (show what would be uploaded)
    python -m scripts.upload_local_logs /path/to/logs --dry-run

    # Skip rating update
    python -m scripts.upload_local_logs /path/to/logs --skip-ratings
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.core.constants import CURRENT_ENGINE_VERSION
from app.core.database import SessionLocal
from app.models import Game, GameParticipant, GameStatus, Model, PlayerRole
from app.services.rating_service import update_ratings_for_game
from app.services.storage_service import upload_game_logs


def read_summary_json(experiment_dir: Path) -> dict:
    """Read the game summary from summary.json."""
    summary_path = experiment_dir / "summary.json"
    if not summary_path.exists():
        raise FileNotFoundError(f"summary.json not found in {experiment_dir}")

    with open(summary_path, "r") as f:
        return json.load(f)


def read_agent_logs(experiment_dir: Path) -> list[dict]:
    """Read agent logs from agent-logs-compact.json."""
    logs_path = experiment_dir / "agent-logs-compact.json"
    if not logs_path.exists():
        # Try the pretty-printed version
        logs_path = experiment_dir / "agent-logs.json"
        if not logs_path.exists():
            raise FileNotFoundError(
                f"No agent logs found in {experiment_dir} "
                "(tried agent-logs-compact.json and agent-logs.json)"
            )

    logs = []
    with open(logs_path, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                logs.append(json.loads(line))
    return logs


def get_model_by_openrouter_id(db, openrouter_id: str) -> Model | None:
    """Look up a model by its OpenRouter ID."""
    return db.query(Model).filter(Model.openrouter_id == openrouter_id).first()


def create_game_from_summary(db, game_id: str, summary: dict, agent_logs: list) -> Game:
    """Create a Game record and participants from the summary data."""
    # Extract winner info
    winner = summary.get("winner")
    winner_reason = summary.get("winner_reason", "")

    # Create the game record
    game = Game(
        id=game_id,
        status=GameStatus.COMPLETED,
        winner=winner,
        winner_reason=winner_reason,
        engine_version=CURRENT_ENGINE_VERSION,
        started_at=datetime.now(timezone.utc),  # We don't have exact start time from logs
        ended_at=datetime.now(timezone.utc),
    )
    db.add(game)
    db.flush()  # Get the game ID

    # Determine which team won
    impostors_won = winner in (1, 4)  # Codes 1 and 4 are impostor wins

    # Process each player
    model_ids = []
    for i in range(1, 8):
        player_key = f"Player {i}"
        player_data = summary.get(player_key)

        if not player_data:
            raise ValueError(f"Missing {player_key} in game summary")

        openrouter_id = player_data.get("model")
        if not openrouter_id:
            raise ValueError(f"Missing 'model' for {player_key} in game summary")

        # Look up the model in the database
        model = get_model_by_openrouter_id(db, openrouter_id)
        if not model:
            raise ValueError(
                f"Unknown model '{openrouter_id}' for {player_key}. "
                f"Make sure this model is registered in the database."
            )

        model_ids.append(model.id)

        identity = player_data.get("identity")
        if identity not in ("Impostor", "Crewmate"):
            raise ValueError(f"Invalid identity '{identity}' for {player_key}")
        role = PlayerRole.IMPOSTOR if identity == "Impostor" else PlayerRole.CREWMATE

        color = player_data.get("color")
        if not color:
            raise ValueError(f"Missing 'color' for {player_key}")

        # Determine if this player won
        player_won = (role == PlayerRole.IMPOSTOR) == impostors_won

        participant = GameParticipant(
            game_id=game.id,
            model_id=model.id,
            player_number=i,
            player_color=color,
            role=role,
            won=player_won,
        )
        db.add(participant)

    # Store model IDs in the game record
    game.model_ids = model_ids
    db.flush()

    return game


def process_single_game(
    db,
    game_index: int,
    summary: dict,
    agent_logs: list,
    experiment_name: str,
    prefix: str | None,
    dry_run: bool,
    skip_ratings: bool,
) -> bool:
    """Process a single game from the summary. Returns True on success."""
    game_key = f"Game {game_index}"

    if game_key not in summary:
        print(f"  {game_key}: Not found in summary")
        return False

    game_summary = summary[game_key]

    # Generate game ID
    if prefix:
        game_id = f"{prefix}_{experiment_name}_g{game_index}"
    else:
        game_id = f"{experiment_name}_g{game_index}"

    # Check if game already exists
    existing = db.query(Game).filter(Game.id == game_id).first()
    if existing:
        print(f"  {game_key}: SKIP (already exists: {game_id})")
        return False

    if dry_run:
        winner = game_summary.get("winner")
        winner_reason = game_summary.get("winner_reason", "")
        print(f"  {game_key}: Would create {game_id}")
        print(f"    Winner: {winner} - {winner_reason}")
        for i in range(1, 8):
            player_key = f"Player {i}"
            player_data = game_summary.get(player_key, {})
            print(
                f"    {player_key}: {player_data.get('model')} "
                f"({player_data.get('identity')}, {player_data.get('color')})"
            )
        return True

    try:
        print(f"  {game_key}: Creating {game_id}...", end=" ", flush=True)
        game = create_game_from_summary(db, game_id, game_summary, agent_logs)

        # Upload to S3
        bucket, key = upload_game_logs(game.id, game_summary, agent_logs)
        game.log_bucket = bucket
        game.log_key = key

        # Update ratings
        if not skip_ratings:
            update_ratings_for_game(db, game)

        db.commit()
        print("✓")
        return True

    except ValueError as e:
        print(f"✗ {e}")
        db.rollback()
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        db.rollback()
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Upload local amongagents logs to S3 and update database"
    )
    parser.add_argument(
        "experiment_dir",
        type=Path,
        help="Path to the amongagents experiment directory",
    )
    parser.add_argument(
        "--game-index",
        type=int,
        default=None,
        help="Upload only a specific game index (0, 1, 2, ...) from the summary",
    )
    parser.add_argument(
        "--prefix",
        type=str,
        default=None,
        help="Prefix for generated game IDs (default: experiment directory name)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be uploaded without actually uploading",
    )
    parser.add_argument(
        "--skip-ratings",
        action="store_true",
        help="Skip updating ratings after upload",
    )
    args = parser.parse_args()

    experiment_dir = args.experiment_dir.expanduser().resolve()

    if not experiment_dir.exists():
        print(f"ERROR: Directory not found: {experiment_dir}")
        sys.exit(1)

    experiment_name = experiment_dir.name
    prefix = args.prefix or experiment_name

    print(f"Reading logs from: {experiment_dir}")

    # Read the log files
    try:
        summary = read_summary_json(experiment_dir)
        agent_logs = read_agent_logs(experiment_dir)
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse JSON: {e}")
        sys.exit(1)

    print(f"Agent log entries: {len(agent_logs)}")

    # Find all game keys in the summary
    game_keys = [k for k in summary.keys() if k.startswith("Game ")]
    game_indices = sorted([int(k.split(" ")[1]) for k in game_keys])

    if not game_indices:
        print("ERROR: No games found in summary.json")
        sys.exit(1)

    print(
        f"Games in summary: {len(game_indices)} (indices {min(game_indices)}-{max(game_indices)})"
    )

    # Determine which games to process
    if args.game_index is not None:
        if args.game_index not in game_indices:
            print(f"ERROR: Game index {args.game_index} not found in summary")
            sys.exit(1)
        games_to_process = [args.game_index]
    else:
        games_to_process = game_indices

    print(f"\nProcessing {len(games_to_process)} game(s)...")
    if args.dry_run:
        print("[DRY RUN - no changes will be made]\n")

    # Process games
    db = SessionLocal()
    try:
        success_count = 0
        for idx in games_to_process:
            if process_single_game(
                db,
                idx,
                summary,
                agent_logs,
                experiment_name,
                prefix,
                args.dry_run,
                args.skip_ratings,
            ):
                success_count += 1

        print(f"\n{'=' * 50}")
        print(f"Processed: {success_count}/{len(games_to_process)} games")
        if args.dry_run:
            print("(Dry run - no actual changes made)")
        print(f"{'=' * 50}")

    finally:
        db.close()

    if success_count < len(games_to_process) and not args.dry_run:
        sys.exit(1)


if __name__ == "__main__":
    main()
