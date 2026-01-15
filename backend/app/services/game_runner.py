"""Game runner service that integrates with amongagents.

This service handles running Among Us games using the amongagents package,
updating ratings, and storing game logs.
"""

import asyncio
import random
import traceback
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models import Game, GameParticipant, GameStatus, Model, PlayerRole
from app.services.rating_service import update_ratings_for_game
from app.services.storage_service import upload_game_logs


# Player colors used in Among Us
PLAYER_COLORS = [
    "red", "blue", "green", "pink", "orange", "yellow", "black", "white",
    "purple", "brown", "cyan", "lime"
]


def run_game_task(game_id: str, model_ids: list[str]) -> None:
    """
    Background task to run a game.

    This is called by FastAPI's BackgroundTasks and runs synchronously.
    It creates its own event loop to run the async game code.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(run_game_async(game_id, model_ids))
    finally:
        loop.close()


async def run_game_async(game_id: str, model_ids: list[str]) -> None:
    """
    Run a game asynchronously.

    Steps:
    1. Update game status to RUNNING
    2. Set up players and assign roles
    3. Run the game using amongagents
    4. Update game with results
    5. Update ratings
    6. Upload logs to S3
    7. Call webhook if configured
    """
    db = SessionLocal()
    settings = get_settings()

    try:
        # Get game and models
        game = db.query(Game).filter(Game.id == game_id).first()
        if not game:
            return

        models = []
        for mid in model_ids:
            model = db.query(Model).filter(Model.id == mid).first()
            if model:
                models.append(model)

        if len(models) != 7:
            game.status = GameStatus.FAILED
            game.error_message = f"Expected 7 models, got {len(models)}"
            db.commit()
            return

        # Update status to running
        game.status = GameStatus.RUNNING
        game.started_at = datetime.now(timezone.utc)
        db.commit()

        # Shuffle models and assign roles (2 impostors, 5 crewmates)
        shuffled_models = models.copy()
        random.shuffle(shuffled_models)

        colors = random.sample(PLAYER_COLORS, 7)

        # Create participants
        for i, model in enumerate(shuffled_models):
            role = PlayerRole.IMPOSTOR if i < 2 else PlayerRole.CREWMATE
            participant = GameParticipant(
                game_id=game.id,
                model_id=model.id,
                player_number=i + 1,
                player_color=colors[i],
                role=role,
            )
            db.add(participant)

        db.commit()
        db.refresh(game)

        # Run the actual game
        winner, winner_reason, summary, agent_logs = await execute_amongagents_game(
            game, shuffled_models, colors, settings.openrouter_api_key
        )

        # Update game with results
        game.winner = winner
        game.winner_reason = winner_reason
        game.status = GameStatus.COMPLETED
        game.ended_at = datetime.now(timezone.utc)

        # Upload logs to S3
        try:
            bucket, key = upload_game_logs(game.id, summary, agent_logs)
            game.log_bucket = bucket
            game.log_key = key
        except Exception as e:
            # Log storage failure shouldn't fail the game
            print(f"Failed to upload logs: {e}")

        # Update ratings
        update_ratings_for_game(db, game)

        db.commit()

        # Call webhook if configured
        if game.webhook_url:
            await call_webhook(game.webhook_url, game.id, winner, winner_reason)

    except Exception as e:
        # Handle any errors
        db.rollback()
        game = db.query(Game).filter(Game.id == game_id).first()
        if game:
            game.status = GameStatus.FAILED
            game.error_message = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
            game.ended_at = datetime.now(timezone.utc)
            db.commit()

    finally:
        db.close()


async def execute_amongagents_game(
    game: Game,
    models: list[Model],
    colors: list[str],
    openrouter_api_key: str,
) -> tuple[int, str, dict, list]:
    """
    Execute the actual Among Us game using amongagents.

    Returns:
        tuple of (winner_code, winner_reason, summary_dict, agent_logs_list)
    """
    # Import amongagents here to avoid import errors if not installed
    try:
        from amongagents import AmongUs
        from amongagents.envs.configs.game_config import SEVEN_MEMBER_GAME
    except ImportError:
        # Mock implementation for testing without amongagents installed
        return await mock_game_execution(game, models, colors)

    # Set up the agent configuration for all LLM players
    agent_config = {
        "Impostor": "LLM",
        "Crewmate": "LLM",
        "CREWMATE_LLM_CHOICES": [m.openrouter_id for m in models[2:]],  # Crewmates
        "IMPOSTOR_LLM_CHOICES": [m.openrouter_id for m in models[:2]],  # Impostors
        "assignment_mode": "sequential",
    }

    # Create and run the game
    game_instance = AmongUs(
        game_config=SEVEN_MEMBER_GAME,
        include_human=False,
        test=False,
        personality=False,
        agent_config=agent_config,
        interviewer=None,
        UI=None,
        game_index=0,
    )

    winner = await game_instance.run_game()

    # Extract summary and logs
    summary = game_instance.summary_json.get("Game 0", {})
    agent_logs = []  # Would extract from game_instance if available

    winner_reasons = {
        1: "Impostors win! (Crewmates outnumbered)",
        2: "Crewmates win! (All impostors eliminated)",
        3: "Crewmates win! (All tasks completed)",
        4: "Impostors win! (Time limit reached)",
    }

    return winner, winner_reasons.get(winner, f"Unknown outcome ({winner})"), summary, agent_logs


async def mock_game_execution(
    game: Game,
    models: list[Model],
    colors: list[str],
) -> tuple[int, str, dict, list]:
    """
    Mock game execution for testing without amongagents installed.

    Simulates a random game outcome.
    """
    # Simulate some game time
    await asyncio.sleep(0.5)

    # Random winner (1-4)
    winner = random.choice([1, 2, 3, 4])

    winner_reasons = {
        1: "Impostors win! (Crewmates outnumbered)",
        2: "Crewmates win! (All impostors eliminated)",
        3: "Crewmates win! (All tasks completed)",
        4: "Impostors win! (Time limit reached)",
    }

    # Build mock summary
    summary = {
        "config": {"num_players": 7, "num_impostors": 2},
        "winner": winner,
        "winner_reason": winner_reasons[winner],
    }

    for i, model in enumerate(models):
        role = "Impostor" if i < 2 else "Crewmate"
        summary[f"Player {i+1}"] = {
            "name": f"Player {i+1}: {colors[i]}",
            "color": colors[i],
            "identity": role,
            "model": model.openrouter_id,
        }

    agent_logs = [
        {
            "game_index": "Game 0",
            "mock": True,
            "message": "This is a mock game for testing",
        }
    ]

    return winner, winner_reasons[winner], summary, agent_logs


async def call_webhook(webhook_url: str, game_id: str, winner: int, winner_reason: str) -> None:
    """Call the configured webhook with game results."""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                webhook_url,
                json={
                    "event": "game_complete",
                    "game_id": game_id,
                    "winner": winner,
                    "winner_reason": winner_reason,
                },
                timeout=10.0,
            )
    except Exception as e:
        # Webhook failures shouldn't crash the game runner
        print(f"Webhook call failed: {e}")
