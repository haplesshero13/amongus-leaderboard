"""Game runner service that integrates with amongagents.

This service handles running Among Us games using the amongagents package,
updating ratings, and storing game logs.
"""

import asyncio
import json
import logging
import os
import random
import re
import tempfile
import traceback
from datetime import datetime, timezone
from pathlib import Path

import httpx

from amongagents import AmongUs
from amongagents.envs.configs.game_config import SEVEN_MEMBER_GAME
from app.core.config import get_settings
from app.core.constants import GAME_TIMEOUT_SECONDS
from app.core.database import SessionLocal
from app.models import Game, GameParticipant, GameStatus, Model, PlayerRole
from app.services.rating_service import update_ratings_for_game
from app.services.storage_service import upload_game_logs
from app.services import live_logs

logger = logging.getLogger(__name__)


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


def _transform_long_context_log(entry: dict) -> dict:
    """Transform a LongContextAgent log entry to the frontend-expected format.

    LongContextAgent writes flat entries with top-level player/thinking/action.
    The frontend expects nested player objects and interaction.response structures.
    """
    location = ""
    for msg in entry.get("messages", []):
        if msg.get("role") == "user":
            m = re.search(r"CURRENT LOCATION: (\S+)", msg.get("content", ""))
            if m:
                location = m.group(1)
            break

    return {
        "game_index": entry.get("game_index"),
        "step": entry.get("step"),
        "timestamp": entry.get("timestamp"),
        "player": {
            "name": entry.get("player", ""),
            "identity": entry.get("identity", ""),
            "model": entry.get("model", ""),
            "location": location,
        },
        "interaction": {
            "response": {
                "Action": entry.get("action", ""),
                "Thinking Process": entry.get("thinking", ""),
            },
        },
    }


def read_agent_logs(experiment_dir: str) -> list:
    """
    Read agent logs from the experiment directory.

    Supports both the LongContextAgent format (agent-logs.jsonl) and the
    legacy LLMAgent format (agent-logs-compact.json). LongContextAgent logs
    are transformed to the frontend-expected structure.
    """
    exp = Path(experiment_dir)

    # LongContextAgent writes to agent-logs.jsonl
    long_ctx_path = exp / "agent-logs.jsonl"
    if long_ctx_path.exists():
        logs = []
        with open(long_ctx_path, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    entry = json.loads(line)
                    logs.append(_transform_long_context_log(entry))
        return logs

    # Legacy: compact JSONL format
    agent_logs_path = exp / "agent-logs-compact.json"
    if not agent_logs_path.exists():
        # Fall back to the pretty-printed version
        agent_logs_path = exp / "agent-logs.json"
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

    Supports both LongContextAgent (agent-logs.jsonl) and legacy
    (agent-logs-compact.json) log formats.

    Args:
        game_id: The game ID to stream logs for
        experiment_dir: Path to the experiment directory containing logs
        stop_event: Event to signal when to stop polling
    """
    exp = Path(experiment_dir)
    # Try LongContextAgent path first, fall back to legacy
    long_ctx_path = exp / "agent-logs.jsonl"
    legacy_path = exp / "agent-logs-compact.json"
    log_path = None
    is_long_context = False
    lines_read = 0

    while not stop_event.is_set():
        try:
            # Resolve which log file to use (once it appears)
            if log_path is None:
                if long_ctx_path.exists():
                    log_path = long_ctx_path
                    is_long_context = True
                elif legacy_path.exists():
                    log_path = legacy_path

            if log_path is not None and log_path.exists():
                with open(log_path) as f:
                    all_lines = f.readlines()

                # Push any new lines since last read
                for line in all_lines[lines_read:]:
                    line = line.strip()
                    if line:
                        try:
                            entry = json.loads(line)
                            if is_long_context:
                                entry = _transform_long_context_log(entry)
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
            logger.warning("Error polling logs for game %s: %s", game_id, e)
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
    Works with both LongContextAgent (transformed) and legacy log formats.
    """
    for log in agent_logs:
        interaction = log.get("interaction", {})
        response = interaction.get("response")
        full_response = interaction.get("full_response")

        # For transformed LongContextAgent logs, check the Action field
        if isinstance(response, dict):
            action = response.get("Action") or response.get("action")
            if action:
                continue  # Has a valid action

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


class GameResult:
    """Plain data object for game execution results. No ORM dependencies."""

    __slots__ = ("winner", "winner_reason", "summary", "agent_logs", "experiment_dir")

    def __init__(
        self, winner: int, winner_reason: str, summary: dict, agent_logs: list, experiment_dir: str
    ):
        self.winner = winner
        self.winner_reason = winner_reason
        self.summary = summary
        self.agent_logs = agent_logs
        self.experiment_dir = experiment_dir


class _GamePrep:
    """Internal data for a prepared game ready for execution. No ORM dependencies."""

    __slots__ = ("game_id", "openrouter_ids", "model_id_to_uuid", "webhook_url")

    def __init__(
        self,
        game_id: str,
        openrouter_ids: list[str],
        model_id_to_uuid: dict[str, str],
        webhook_url: str | None,
    ):
        self.game_id = game_id
        self.openrouter_ids = openrouter_ids
        self.model_id_to_uuid = model_id_to_uuid
        self.webhook_url = webhook_url


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
        game_id: Game ID to run.
        model_ids: Model UUIDs for players.
        randomize_roles: Whether to shuffle models before assigning roles.
        stream_logs: When False, skip live log streaming during bulk runs.
    """
    logger.info("Starting background task for game %s", game_id)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(run_game_async(game_id, model_ids, randomize_roles, stream_logs))
    finally:
        loop.close()
    logger.info("Background task for game %s finished", game_id)


async def run_game_async(
    game_id: str,
    model_ids: list[str],
    randomize_roles: bool = True,
    stream_logs: bool = True,
) -> None:
    """
    Orchestrate a single game: load from DB, execute, save results.

    The DB connection is only held during reads/writes, never during game execution.

    Args:
        game_id: Game ID to run.
        model_ids: Model UUIDs for players.
        randomize_roles: Whether to shuffle models before assigning roles.
        stream_logs: When False, skip live log streaming during bulk runs.
    """
    try:
        await _run_game_async_inner(game_id, model_ids, randomize_roles, stream_logs)
    except BaseException as e:
        # Failsafe: if anything escapes the inner function, mark game as FAILED.
        # Uses BaseException (not Exception) to also catch CancelledError, which
        # is a BaseException in Python 3.9+. Without this, cancelled games
        # (e.g. from asyncio.gather cancellation) stay RUNNING forever.
        logger.error("Unhandled error in game %s: %s", game_id, e, exc_info=True)
        db = SessionLocal()
        try:
            _mark_game_failed(db, game_id, e)
        except Exception:
            logger.error("Failed to mark game %s as failed", game_id, exc_info=True)
        finally:
            db.close()


async def _run_game_async_inner(
    game_id: str,
    model_ids: list[str],
    randomize_roles: bool,
    stream_logs: bool,
) -> None:
    """Inner implementation of run_game_async (unwrapped)."""
    settings = get_settings()

    # Step 1: Load game data, mark as RUNNING
    db = SessionLocal()
    try:
        game = db.query(Game).filter(Game.id == game_id).first()
        if not game:
            logger.error("Game %s not found in DB", game_id)
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

        game.status = GameStatus.RUNNING
        game.started_at = datetime.now(timezone.utc)
        game.model_ids = [m.id for m in models]
        db.commit()

        # Extract plain data for the game execution (no ORM objects leave this block)
        openrouter_ids = [m.openrouter_id for m in models]
        model_id_to_uuid = {m.openrouter_id: m.id for m in models}
        webhook_url = game.webhook_url
    except Exception as e:
        db.rollback()
        _mark_game_failed(db, game_id, e)
        return
    finally:
        db.close()

    # Step 2: Execute the game (no DB connection held)
    if stream_logs:
        live_logs.start_game(game_id)

    try:
        result = await asyncio.wait_for(
            execute_amongagents_game(
                game_id, openrouter_ids, settings.openrouter_api_key, stream_logs=stream_logs
            ),
            timeout=GAME_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error("Game %s timed out after %d seconds", game_id, GAME_TIMEOUT_SECONDS)
        if stream_logs:
            live_logs.end_game(game_id, None)
        db = SessionLocal()
        try:
            _mark_game_failed(
                db, game_id, TimeoutError(f"Game execution timed out after {GAME_TIMEOUT_SECONDS}s")
            )
        finally:
            db.close()
        return
    except Exception as e:
        if stream_logs:
            live_logs.end_game(game_id, None)
        db = SessionLocal()
        try:
            _mark_game_failed(db, game_id, e)
        finally:
            db.close()
        return

    # Step 3: Save results to DB
    db = SessionLocal()
    try:
        await _save_game_results(db, game_id, result, model_id_to_uuid, stream_logs)
    except Exception as e:
        db.rollback()
        if stream_logs:
            live_logs.end_game(game_id, None)
        _mark_game_failed(db, game_id, e)
        return
    finally:
        db.close()

    # Step 4: Webhook (best-effort, after DB is committed and closed)
    if webhook_url:
        await call_webhook(webhook_url, game_id, result.winner, result.winner_reason)


def _mark_game_failed(db, game_id: str, error: Exception) -> None:
    """Mark a game as failed with the error details."""
    game = db.query(Game).filter(Game.id == game_id).first()
    if game:
        game.status = GameStatus.FAILED
        game.error_message = f"{type(error).__name__}: {str(error)}\n{traceback.format_exc()}"
        game.ended_at = datetime.now(timezone.utc)
        db.commit()


def _force_fail_game(db, game_id: str, error: Exception) -> None:
    """Last-resort: force a game to FAILED state using a fresh session.

    Called when _mark_game_failed itself fails (e.g. the session is in a
    broken state after a rollback). Uses a fresh session to prevent games
    from being stuck in RUNNING forever.
    """
    try:
        db.rollback()
    except Exception:
        pass

    fresh_db = SessionLocal()
    try:
        game = fresh_db.query(Game).filter(Game.id == game_id).first()
        if game and game.status != GameStatus.FAILED:
            game.status = GameStatus.FAILED
            game.error_message = f"FORCE FAILED — original error: {type(error).__name__}: {error}"
            game.ended_at = datetime.now(timezone.utc)
            fresh_db.commit()
            logger.warning("Force-failed game %s with fresh session", game_id)
    except Exception:
        logger.critical(
            "Could not force-fail game %s — game may be stuck in RUNNING",
            game_id,
            exc_info=True,
        )
    finally:
        fresh_db.close()


def _prepare_game(
    db, game_id: str, model_ids: list[str], randomize_roles: bool
) -> _GamePrep | None:
    """Load models and mark a game as RUNNING. Returns None on failure.

    This is used by the bulk runner to prepare all games with a single
    DB connection before concurrent execution begins.
    """
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        logger.error("Game %s not found in DB", game_id)
        return None

    models = []
    for mid in model_ids:
        model = db.query(Model).filter(Model.id == mid).first()
        if model:
            models.append(model)

    if len(models) != 7:
        game.status = GameStatus.FAILED
        game.error_message = f"Expected 7 models, got {len(models)}"
        return None

    if randomize_roles:
        random.shuffle(models)

    game.status = GameStatus.RUNNING
    game.started_at = datetime.now(timezone.utc)
    game.model_ids = [m.id for m in models]

    return _GamePrep(
        game_id=game_id,
        openrouter_ids=[m.openrouter_id for m in models],
        model_id_to_uuid={m.openrouter_id: m.id for m in models},
        webhook_url=game.webhook_url,
    )


async def _save_game_results(
    db,
    game_id: str,
    result: "GameResult",
    model_id_to_uuid: dict[str, str],
    stream_logs: bool,
) -> None:
    """Save game results, participants, logs, and ratings to the DB."""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        return

    game.winner = result.winner
    game.winner_reason = result.winner_reason
    game.status = GameStatus.COMPLETED
    game.ended_at = datetime.now(timezone.utc)

    # Create participants from the game summary (source of truth)
    for i in range(1, 8):
        player_key = f"Player {i}"
        player_data = result.summary.get(player_key)
        if not player_data:
            raise ValueError(f"Missing {player_key} in game summary")

        openrouter_id = player_data.get("model")
        if not openrouter_id:
            raise ValueError(f"Missing 'model' for {player_key} in game summary")

        model_uuid = model_id_to_uuid.get(openrouter_id)
        if not model_uuid:
            raise ValueError(f"Unknown model '{openrouter_id}' for {player_key}")

        identity = player_data.get("identity")
        if identity not in ("Impostor", "Crewmate"):
            raise ValueError(f"Invalid identity '{identity}' for {player_key}")
        role = PlayerRole.IMPOSTOR if identity == "Impostor" else PlayerRole.CREWMATE

        color = player_data.get("color")
        if not color:
            raise ValueError(f"Missing 'color' for {player_key} in game summary")

        impostors_won = result.winner in (1, 4)
        player_won = (role == PlayerRole.IMPOSTOR) == impostors_won

        participant = GameParticipant(
            game_id=game.id,
            model_id=model_uuid,
            player_number=i,
            player_color=color,
            role=role,
            won=player_won,
            survived=None,
        )
        db.add(participant)

    db.flush()
    db.refresh(game)

    # Upload logs to S3 with retry (async — doesn't block event loop)
    bucket, key = await _upload_logs_with_retry(game.id, result)
    game.log_bucket = bucket
    game.log_key = key

    # Update ratings
    update_ratings_for_game(db, game)

    if stream_logs:
        live_logs.end_game(game_id, result.summary)

    db.commit()


async def _upload_logs_with_retry(
    game_id: str, result: "GameResult", max_retries: int = 3
) -> tuple[str, str]:
    """Upload logs to S3 with retries.

    Uses asyncio.to_thread for the synchronous boto3 call and asyncio.sleep
    for retry delays, so the event loop is never blocked.
    """
    retry_delay = 1.0
    last_error = None

    for attempt in range(max_retries):
        try:
            return await asyncio.to_thread(
                upload_game_logs, game_id, result.summary, result.agent_logs
            )
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                logger.warning("Log upload attempt %d/%d failed: %s", attempt + 1, max_retries, e)
                await asyncio.sleep(retry_delay)
                retry_delay *= 2

    raise RuntimeError(
        f"Failed to upload logs after {max_retries} attempts. "
        f"Last error: {last_error}. "
        f"Temp dir with logs: {result.experiment_dir}"
    )


async def execute_amongagents_game(
    game_id: str,
    openrouter_ids: list[str],
    openrouter_api_key: str,
    stream_logs: bool = True,
) -> GameResult:
    """
    Execute an Among Us game. Pure function — no DB access.

    Args:
        game_id: Game ID (used for temp dir naming and log streaming).
        openrouter_ids: Ordered list of 7 model openrouter IDs
                        (first 2 are impostors, rest are crewmates).
        openrouter_api_key: API key for OpenRouter.
        stream_logs: When False, skip live log streaming during bulk runs.

    Returns:
        GameResult with winner, summary, logs, and experiment dir.
    """
    # Set up experiment path for amongagents (required for agent logging)
    experiment_dir = tempfile.mkdtemp(prefix=f"game_{game_id}_")
    os.environ["EXPERIMENT_PATH"] = experiment_dir
    os.environ["OPENROUTER_API_KEY"] = openrouter_api_key

    # Set up the agent configuration for all LongContext players
    # "unique" mode pops models from lists sequentially: each model is used exactly once
    agent_config = {
        "Impostor": "LongContext",
        "Crewmate": "LongContext",
        "CREWMATE_LLM_CHOICES": list(openrouter_ids[2:]),  # Crewmates
        "IMPOSTOR_LLM_CHOICES": list(openrouter_ids[:2]),  # Impostors
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

    stop_polling = asyncio.Event()
    polling_task = None
    if stream_logs:
        polling_task = asyncio.create_task(
            poll_logs_to_stream(game_id, experiment_dir, stop_polling)
        )

    try:
        winner = await game_instance.run_game()
    finally:
        if polling_task is not None:
            stop_polling.set()
            await polling_task

    # Extract summary and logs
    summary = game_instance.summary_json.get("Game 0", {})

    # Validate that the models that played match what we requested
    validate_model_assignment(list(openrouter_ids), summary)

    # Read and validate agent logs
    agent_logs = read_agent_logs(experiment_dir)
    validate_agent_logs(agent_logs)

    winner_reasons = {
        1: "Impostors win! (Crewmates outnumbered)",
        2: "Crewmates win! (All impostors eliminated)",
        3: "Crewmates win! (All tasks completed)",
        4: "Impostors win! (Time limit reached)",
    }

    return GameResult(
        winner=winner,
        winner_reason=winner_reasons.get(winner, f"Unknown outcome ({winner})"),
        summary=summary,
        agent_logs=agent_logs,
        experiment_dir=experiment_dir,
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
        logger.warning("Webhook call failed for game %s: %s", game_id, e)


async def run_multiple_games_async(
    game_ids: list[str],
    model_ids_list: list[list[str]],
    rate_limit: int = 50,
    randomize_roles: bool = True,
    stream_logs: bool = False,
) -> None:
    """
    Run multiple games concurrently with rate limiting.

    Follows the AmongLLMs/main.py pattern: pure concurrent game execution
    with zero DB connections during execution, and serial result saving
    afterward using a single DB connection.

    Phase 1: One DB connection — prepare all games (mark RUNNING, load models)
    Phase 2: Concurrent execution — no DB connections
    Phase 3: One DB connection — save all results serially

    Args:
        game_ids: List of game IDs to run
        model_ids_list: List of model ID lists (one per game)
        rate_limit: Maximum number of concurrent games
        randomize_roles: Whether to shuffle models before assigning roles
        stream_logs: Enable live log streaming (recommended: false for bulk)
    """
    settings = get_settings()
    logger.info("Running %d games concurrently (rate_limit=%d)", len(game_ids), rate_limit)

    # ── Phase 1: Prepare all games (one DB connection) ──────────────
    db = SessionLocal()
    preps: list[_GamePrep | None] = []
    try:
        for game_id, model_ids in zip(game_ids, model_ids_list):
            try:
                prep = _prepare_game(db, game_id, model_ids, randomize_roles)
            except Exception as e:
                logger.error("Failed to prepare game %s: %s", game_id, e)
                prep = None
            preps.append(prep)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    valid_preps = [p for p in preps if p is not None]
    if not valid_preps:
        logger.warning("No games could be prepared, nothing to execute")
        return

    logger.info("Prepared %d/%d games, starting execution", len(valid_preps), len(game_ids))

    # ── Phase 2: Execute games concurrently, save each result immediately ──
    # An asyncio.Lock serializes DB writes so only one connection is open at
    # a time, but games don't have to wait for all others to finish before
    # their results are persisted.
    semaphore = asyncio.Semaphore(rate_limit)
    db_lock = asyncio.Lock()
    failures = 0

    async def run_and_save(prep: _GamePrep) -> None:
        nonlocal failures

        # Execute (no DB)
        if stream_logs:
            live_logs.start_game(prep.game_id)
        try:
            async with semaphore:
                result = await asyncio.wait_for(
                    execute_amongagents_game(
                        prep.game_id,
                        prep.openrouter_ids,
                        settings.openrouter_api_key,
                        stream_logs=stream_logs,
                    ),
                    timeout=GAME_TIMEOUT_SECONDS,
                )
        except asyncio.TimeoutError:
            logger.error("Game %s timed out after %ds", prep.game_id, GAME_TIMEOUT_SECONDS)
            result = TimeoutError(f"Game execution timed out after {GAME_TIMEOUT_SECONDS}s")
        except BaseException as exc:
            if stream_logs:
                live_logs.end_game(prep.game_id, None)
            result = exc

        # Save (one DB connection at a time via lock)
        async with db_lock:
            db = SessionLocal()
            try:
                if isinstance(result, BaseException):
                    failures += 1
                    logger.error("Game %s failed: %s", prep.game_id, result)
                    try:
                        _mark_game_failed(db, prep.game_id, result)
                    except Exception:
                        logger.error(
                            "Failed to mark game %s as failed", prep.game_id, exc_info=True
                        )
                        _force_fail_game(db, prep.game_id, result)
                else:
                    try:
                        await _save_game_results(
                            db, prep.game_id, result, prep.model_id_to_uuid, stream_logs
                        )
                    except Exception as e:
                        failures += 1
                        logger.error(
                            "Failed to save results for game %s: %s",
                            prep.game_id,
                            e,
                            exc_info=True,
                        )
                        db.rollback()
                        try:
                            _mark_game_failed(db, prep.game_id, e)
                        except Exception:
                            logger.error(
                                "Failed to mark game %s as failed",
                                prep.game_id,
                                exc_info=True,
                            )
                            _force_fail_game(db, prep.game_id, e)
            finally:
                db.close()

        # Webhook (best-effort, after DB is closed)
        if not isinstance(result, BaseException) and prep.webhook_url:
            await call_webhook(prep.webhook_url, prep.game_id, result.winner, result.winner_reason)

    tasks = [run_and_save(p) for p in valid_preps]
    # return_exceptions=True prevents one failing game from cancelling all others.
    await asyncio.gather(*tasks, return_exceptions=True)

    logger.info("All %d games finished (%d failures)", len(valid_preps), failures)


def run_multiple_games_task(
    game_ids: list[str],
    model_ids_list: list[list[str]],
    rate_limit: int = 50,
    randomize_roles: bool = True,
    stream_logs: bool = False,
) -> None:
    """
    Background task to run multiple games concurrently.

    This creates its own event loop for running async games, similar to
    run_game_task but for bulk operations.

    Args:
        game_ids: List of game IDs to run
        model_ids_list: List of model ID lists (one per game)
        rate_limit: Maximum number of concurrent games
        randomize_roles: Whether to shuffle models before assigning roles
        stream_logs: Enable live log streaming (recommended: false for bulk)
    """
    logger.info("Starting bulk background task for %d games", len(game_ids))
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            run_multiple_games_async(
                game_ids, model_ids_list, rate_limit, randomize_roles, stream_logs
            )
        )
    finally:
        loop.close()
    logger.info("Bulk background task finished for %d games", len(game_ids))
