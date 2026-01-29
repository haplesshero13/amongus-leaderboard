#!/usr/bin/env python3
"""
Setup Local Environment Script

1. Initializes the local SQLite database.
2. Seeds the database with models and games from 'test-logs/'.
3. Uploads game logs to local MinIO.
4. Calculates ratings based on these games.

Prerequisites:
- MinIO running (docker-compose -f docker-compose.dev.yml up -d minio)
- Backend environment set up (uv/pip)
"""

import json
import os
import sys
import glob
from pathlib import Path
from datetime import datetime
import asyncio

# Add backend to path to import app modules
# sys.path.insert(0, str(Path(__file__).parent / "backend"))

# Set default env vars for local setup if not present
os.environ.setdefault("DATABASE_URL", "sqlite:///./leaderboard.db")
os.environ.setdefault("S3_ENDPOINT_URL", "http://localhost:9000")
os.environ.setdefault("S3_BUCKET_NAME", "amongus-game-logs")
os.environ.setdefault("S3_ACCESS_KEY", "minioadmin")
os.environ.setdefault("S3_SECRET_KEY", "minioadmin")
os.environ.setdefault("S3_REGION", "us-east-1")

try:
    from app.core.database import init_db, SessionLocal
    from app.models import Game, GameParticipant, Model, GameStatus, PlayerRole, GameWinner
    from app.services.rating_service import update_ratings_for_game, get_or_create_rating
    from app.services.storage_service import upload_game_logs, ensure_bucket_exists, get_s3_client
except ImportError as e:
    print(f"Error importing backend modules: {e}")
    print("Make sure you are running this from the root directory and 'backend' is accessible.")
    sys.exit(1)


def get_db_session():
    return SessionLocal()


def sanitize_model_id(model_string: str) -> str:
    """Convert a model string (provider/name) into a clean ID."""
    # e.g. "anthropic/claude-haiku-4.5" -> "claude-haiku-4.5"
    if "/" in model_string:
        return model_string.split("/")[-1]
    return model_string.replace(" ", "-").lower()


def get_provider(model_string: str) -> str:
    if "/" in model_string:
        return model_string.split("/")[0].title()
    return "Unknown"


def get_or_create_model(db, model_string: str) -> Model:
    # Check by openrouter_id first
    model = db.query(Model).filter(Model.openrouter_id == model_string).first()
    if model:
        return model

    # Check by model_id (sanitized)
    sanitized_id = sanitize_model_id(model_string)
    model = db.query(Model).filter(Model.model_id == sanitized_id).first()
    if model:
        return model

    # Create new model
    print(f"Creating new model: {model_string}")
    model = Model(
        model_id=sanitized_id,
        model_name=model_string.split("/")[-1].replace("-", " ").title(),
        provider=get_provider(model_string),
        openrouter_id=model_string,
        avatar_color="#808080",  # Default, maybe randomize?
    )
    db.add(model)
    db.flush()
    # Initialize rating
    get_or_create_rating(db, model)
    return model


def process_log_file(db, file_path: str):
    print(f"Processing {file_path}...")
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Failed to read {file_path}: {e}")
        return

    game_id = data.get("game_id")
    if not game_id:
        print(f"No game_id in {file_path}, skipping.")
        return

    # Check if game exists
    game = db.query(Game).filter(Game.id == game_id).first()
    if game:
        print(
            f"Game {game_id} already exists. Updating logs/ratings not implemented to avoid duplication side-effects."
        )
        # Optional: delete and recreate? For now, skip.
        return

    summary = data.get("summary", {})
    agent_logs = data.get("agent_logs", [])
    config = summary.get("config", {})

    # Determine winner
    winner_code = summary.get("winner")

    # Parse timestamp
    uploaded_at_str = data.get("uploaded_at")
    started_at = datetime.fromisoformat(uploaded_at_str) if uploaded_at_str else datetime.now()

    # Create Game
    game = Game(
        id=game_id,
        status=GameStatus.COMPLETED,
        started_at=started_at,
        ended_at=started_at,  # Approx
        winner=winner_code,
        winner_reason=summary.get("winner_reason"),
        webhook_url=None,
    )
    db.add(game)
    db.flush()

    # Process Participants
    # iterate keys like "Player 1", "Player 2"...
    for i in range(1, 8):
        p_key = f"Player {i}"
        p_data = summary.get(p_key)
        if not p_data:
            print(f"Missing {p_key} in summary, skipping game {game_id}")
            db.rollback()
            return

        model_string = p_data.get("model")
        if not model_string:
            print(f"Missing model for {p_key} in game {game_id}, skipping game")
            db.rollback()
            return

        model = get_or_create_model(db, model_string)

        role_str = p_data.get("identity")
        if role_str not in ("Impostor", "Crewmate"):
            print(f"Invalid identity '{role_str}' for {p_key} in game {game_id}, skipping game")
            db.rollback()
            return
        role = PlayerRole.IMPOSTOR if role_str == "Impostor" else PlayerRole.CREWMATE

        color = p_data.get("color")
        if not color:
            print(f"Missing color for {p_key} in game {game_id}, skipping game")
            db.rollback()
            return

        # Determine if this player won based on game outcome
        # Winner codes: 1,4 = impostor win; 2,3 = crewmate win
        impostors_won = winner_code in (1, 4)
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

    db.flush()

    # Upload logs to MinIO
    print(f"Uploading logs for {game_id} to S3...")
    try:
        bucket, key = upload_game_logs(game_id, summary, agent_logs)
        game.log_bucket = bucket
        game.log_key = key
        print(f"Logs uploaded to {bucket}/{key}")
    except Exception as e:
        print(f"Failed to upload logs: {e}")
        # Continue anyway to calculate ratings locally

    # Calculate Ratings
    print(f"Updating ratings for {game_id}...")
    update_ratings_for_game(db, game)

    db.commit()
    print(f"Successfully imported game {game_id}")


def main():
    print("--- Setting up Local Environment ---")

    # 1. Init DB
    print("Initializing Database...")
    init_db()

    db = get_db_session()

    try:
        # 2. Ensure MinIO bucket exists
        print("Checking S3/MinIO...")
        try:
            ensure_bucket_exists()
            print("S3 bucket ready.")
        except Exception as e:
            print(f"Warning: Could not connect to S3/MinIO: {e}")
            print("Is Docker running? 'docker-compose -f docker-compose.dev.yml up -d minio'")
            # we proceed, but log upload will fail

        # 3. Process logs
        log_files = glob.glob("../test-logs/*.json")
        if not log_files:
            print("No log files found in ../test-logs/")

        for log_file in log_files:
            process_log_file(db, log_file)

    finally:
        db.close()

    print("\n--- Setup Complete ---")
    print("Run the backend: cd backend && uvicorn app.main:app --reload")
    print("Run the frontend: cd frontend && bun dev")


if __name__ == "__main__":
    main()
