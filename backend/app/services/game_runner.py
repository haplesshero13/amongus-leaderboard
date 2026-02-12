"""Game runner service that integrates with amongagents.

This service handles running Among Us games using the amongagents package,
updating ratings, and storing game logs.
"""

import asyncio
import json
import os
import random
import tempfile
import traceback
from datetime import datetime, timezone
from pathlib import Path

import httpx

from amongagents import AmongUs
from amongagents.envs.configs.game_config import SEVEN_MEMBER_GAME
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models import Game, GameParticipant, GameStatus, Model, PlayerRole
from app.services.rating_service import update_ratings_for_game
from app.services.storage_service import upload_game_logs
from app.services import live_logs


class EmptyResponseError(Exception):
    """Raised when a model returns an empty response during the game."""

    def __init__(self, player_name: str, model: str, step: int):
        self.player_name = player_name
        self.model = model
        self.step = step
        super().__init__(f"Empty response from {player_name} ({model}) at step {step}")


class ModelMismatchError(Exception):
    """Raised when models that played don't match the requested models."""

    def __init__(self, requested: list[str], actual: list[str]):
        self.requested = requested
        self.actual = actual
        missing = set(requested) - set(actual)
        unexpected = set(actual) - set(requested)
        # Check for duplicates in actual
        from collections import Counter

        actual_counts = Counter(actual)
        duplicates = [m for m, count in actual_counts.items() if count > 1]

        msg_parts = ["Model assignment mismatch:"]
        if missing:
            msg_parts.append(f"Missing models: {sorted(missing)}")
        if unexpected:
            msg_parts.append(f"Unexpected models: {sorted(unexpected)}")
        if duplicates:
            msg_parts.append(f"Duplicate models: {duplicates}")
        msg_parts.append(f"Requested: {sorted(requested)}")
        msg_parts.append(f"Actually played: {sorted(actual)}")

        super().__init__(" | ".join(msg_parts))


def read_agent_logs(experiment_dir: str) -> list:
    """
    Read agent logs from the experiment directory.

    The amongagents package writes logs in JSONL format (one JSON object per line)
    to agent-logs-compact.json.
    """
    # Prefer the compact JSONL format
    agent_logs_path = Path(experiment_dir) / "agent-logs-compact.json"
    if not agent_logs_path.exists():
        # Fall back to the pretty-printed version
        agent_logs_path = Path(experiment_dir) / "agent-logs.json"
        if not agent_logs_path.exists():
            return []

    logs = []
    with open(agent_logs_path, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                logs.append(json.loads(line))  # Let JSON errors propagate
    return logs


async def poll_logs_to_stream(game_id: str, experiment_dir: str, stop_event: asyncio.Event) -> None:
    """Poll the agent log file and push new entries to the live stream.

    This runs concurrently with the game execution, checking for new log
    entries every 1.5 seconds and pushing them to connected SSE clients.

    Args:
        game_id: The game ID to stream logs for
        experiment_dir: Path to the experiment directory containing logs
        stop_event: Event to signal when to stop polling
    """
    log_path = Path(experiment_dir) / "agent-logs-compact.json"
    lines_read = 0

    while not stop_event.is_set():
        try:
            if log_path.exists():
                with open(log_path) as f:
                    all_lines = f.readlines()

                # Push any new lines since last read
                for line in all_lines[lines_read:]:
                    line = line.strip()
                    if line:
                        try:
                            entry = json.loads(line)
                            live_logs.push_log(game_id, entry)
                        except json.JSONDecodeError:
                            # Incomplete line, will retry next poll
                            pass
                lines_read = len(all_lines)

            # Wait before next poll, but check stop_event periodically
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=1.5)
                break  # stop_event was set
            except asyncio.TimeoutError:
                pass  # Continue polling
        except Exception as e:
            # Log but don't crash - streaming is best-effort
            print(f"Error polling logs for game {game_id}: {e}")
            await asyncio.sleep(1.5)


def validate_model_assignment(
    requested_models: list[str],
    summary: dict,
) -> None:
    """
    Validate that the models that actually played match the requested models.

    Raises ModelMismatchError if there's a discrepancy (missing models,
    unexpected models, or duplicates).

    Args:
        requested_models: List of openrouter_ids that were requested
        summary: Game summary from amongagents containing player info
    """
    # Extract models that actually played from the summary
    actual_models = []
    for i in range(1, 8):  # Players 1-7
        player_key = f"Player {i}"
        if player_key in summary:
            model = summary[player_key].get("model")
            if model:
                actual_models.append(model)

    if len(actual_models) != 7:
        raise ModelMismatchError(
            requested=requested_models,
            actual=actual_models,
        )

    # Check that the sets match (same models, same counts)
    if sorted(requested_models) != sorted(actual_models):
        raise ModelMismatchError(
            requested=requested_models,
            actual=actual_models,
        )


def validate_agent_logs(agent_logs: list) -> None:
    """
    Validate that all agent log entries have non-empty responses.

    Raises EmptyResponseError if any model returned an empty response.
    """
    for log in agent_logs:
        interaction = log.get("interaction", {})
        response = interaction.get("response")
        full_response = interaction.get("full_response")

        # Check if response is empty (empty string, None, or empty dict)
        response_empty = response is None or response == "" or response == {}
        full_response_empty = full_response is None or full_response == ""

        if response_empty and full_response_empty:
            player = log.get("player", {})
            raise EmptyResponseError(
                player_name=player.get("name", "Unknown"),
                model=player.get("model", "Unknown"),
                step=log.get("step", -1),
            )


def run_game_task(
    game_id: str,
    model_ids: list[str],
    randomize_roles: bool = True,
    stream_logs: bool = True,
) -> None:
    """
    Background task to run a game.

    This is called by FastAPI's BackgroundTasks and runs synchronously.
    It creates its own event loop to run the async game code.

    Args:
        stream_logs: When False, skip live log streaming during bulk runs.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            run_game_async(game_id, model_ids, randomize_roles, stream_logs)
        )
    finally:
        loop.close()


async def run_game_async(
    game_id: str,
    model_ids: list[str],
    randomize_roles: bool = True,
    stream_logs: bool = True,
) -> None:
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

    Args:
        stream_logs: When False, skip live log streaming during bulk runs.
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

        # Shuffle models to randomize who gets impostor/crewmate roles
        # amongagents assigns Player 1-2 as impostors, 3-7 as crewmates
        if randomize_roles:
            random.shuffle(models)

        # Update status to running and store model IDs
        game.status = GameStatus.RUNNING
        game.started_at = datetime.now(timezone.utc)
        game.model_ids = [m.id for m in models]
        db.commit()

        # Start live log streaming for this game (optional)
        if stream_logs:
            live_logs.start_game(game_id)

        # Run the actual game
        winner, winner_reason, summary, agent_logs, experiment_dir = await execute_amongagents_game(
            game, models, settings.openrouter_api_key, stream_logs=stream_logs
        )

        # Update game with results
        game.winner = winner
        game.winner_reason = winner_reason
        game.status = GameStatus.COMPLETED
        game.ended_at = datetime.now(timezone.utc)

        # Create participants from the game summary (source of truth)
        # Build a map from openrouter_id -> Model for lookup
        model_map = {m.openrouter_id: m for m in models}

        for i in range(1, 8):
            player_key = f"Player {i}"
            player_data = summary.get(player_key)
            if not player_data:
                raise ValueError(f"Missing {player_key} in game summary")

            openrouter_id = player_data.get("model")
            if not openrouter_id:
                raise ValueError(f"Missing 'model' for {player_key} in game summary")

            model = model_map.get(openrouter_id)
            if not model:
                raise ValueError(f"Unknown model '{openrouter_id}' for {player_key}")

            identity = player_data.get("identity")
            if identity not in ("Impostor", "Crewmate"):
                raise ValueError(f"Invalid identity '{identity}' for {player_key}")
            role = PlayerRole.IMPOSTOR if identity == "Impostor" else PlayerRole.CREWMATE

            color = player_data.get("color")
            if not color:
                raise ValueError(f"Missing 'color' for {player_key} in game summary")

            # Determine if this player won based on game outcome
            impostors_won = winner in (1, 4)  # Codes 1 and 4 are impostor wins
            player_won = (role == PlayerRole.IMPOSTOR) == impostors_won

            participant = GameParticipant(
                game_id=game.id,
                model_id=model.id,
                player_number=i,
                player_color=color,
                role=role,
                won=player_won,
                survived=None,  # Could be determined from logs if needed
            )
            db.add(participant)

        # Flush to make participants visible for rating calculation
        db.flush()
        db.refresh(game)

        # Upload logs to S3 with retry
        max_retries = 3
        retry_delay = 1.0  # seconds, doubles each retry
        last_error = None

        for attempt in range(max_retries):
            try:
                bucket, key = upload_game_logs(game.id, summary, agent_logs)
                game.log_bucket = bucket
                game.log_key = key
                break  # Success
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    print(f"Log upload attempt {attempt + 1}/{max_retries} failed: {e}")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
        else:
            # All retries exhausted - fail the game with details
            raise RuntimeError(
                f"Failed to upload logs after {max_retries} attempts. "
                f"Last error: {last_error}. "
                f"Temp dir with logs: {experiment_dir}"
            )

        # Update ratings
        update_ratings_for_game(db, game)

        # End live streaming with summary
        if stream_logs:
            live_logs.end_game(game_id, summary)

        db.commit()

        # Call webhook if configured
        if game.webhook_url:
            await call_webhook(game.webhook_url, game.id, winner, winner_reason)

    except Exception as e:
        # Handle any errors
        db.rollback()
        # End live streaming on failure
        if stream_logs:
            live_logs.end_game(game_id, None)
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
    openrouter_api_key: str,
    stream_logs: bool = True,
) -> tuple[int, str, dict, list, str]:
    """
    Execute the actual Among Us game using amongagents.

    Returns:
        tuple of (winner_code, winner_reason, summary_dict, agent_logs_list, experiment_dir)

    Args:
        stream_logs: When False, skip live log streaming during bulk runs.
    """
    # Set up experiment path for amongagents (required for agent logging)
    experiment_dir = tempfile.mkdtemp(prefix=f"game_{game.id}_")
    os.environ["EXPERIMENT_PATH"] = experiment_dir
    os.environ["OPENROUTER_API_KEY"] = openrouter_api_key

    # Set up the agent configuration for all LLM players
    # "unique" mode pops models from lists sequentially: each model is used exactly once
    agent_config = {
        "Impostor": "LLM",
        "Crewmate": "LLM",
        "CREWMATE_LLM_CHOICES": [m.openrouter_id for m in models[2:]],  # Crewmates
        "IMPOSTOR_LLM_CHOICES": [m.openrouter_id for m in models[:2]],  # Impostors
        "assignment_mode": "unique",
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

    if stream_logs:
        # Start log polling for live streaming
        stop_polling = asyncio.Event()
        polling_task = asyncio.create_task(
            poll_logs_to_stream(game.id, experiment_dir, stop_polling)
        )
        try:
            winner = await game_instance.run_game()
        finally:
            # Stop the polling task
            stop_polling.set()
            await polling_task
    else:
        winner = await game_instance.run_game()

    # Extract summary and logs
    summary = game_instance.summary_json.get("Game 0", {})

    # Validate that the models that played match what we requested
    # This catches bugs in amongagents model assignment
    requested_openrouter_ids = [m.openrouter_id for m in models]
    validate_model_assignment(requested_openrouter_ids, summary)

    # Read agent logs from the experiment directory
    agent_logs = read_agent_logs(experiment_dir)

    # Validate that no model returned an empty response
    # This will raise EmptyResponseError if any response is empty
    validate_agent_logs(agent_logs)

    winner_reasons = {
        1: "Impostors win! (Crewmates outnumbered)",
        2: "Crewmates win! (All impostors eliminated)",
        3: "Crewmates win! (All tasks completed)",
        4: "Impostors win! (Time limit reached)",
    }

    return (
        winner,
        winner_reasons.get(winner, f"Unknown outcome ({winner})"),
        summary,
        agent_logs,
        experiment_dir,
    )


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
