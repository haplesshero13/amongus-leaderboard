import json

from pydantic import BaseModel, Field

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_api_key
from app.api.schemas import (
    TriggerGameRequest,
    MatchmakeRequest,
    TriggerGameResponse,
    BulkTriggerRequest,
    BulkTriggerResponse,
    GameResponse,
    GameParticipantResponse,
    GameStatusEnum,
    GameLogsResponse,
)
from app.core.constants import CURRENT_ENGINE_VERSION
from app.core.database import get_db
from app.models import Game, GameStatus, Model, GameParticipant
from app.services.storage_service import get_game_logs, delete_game_logs
from app.services import live_logs

router = APIRouter(tags=["games"])


@router.post("/games/trigger", response_model=TriggerGameResponse)
async def trigger_game(
    request: TriggerGameRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """
    Trigger a new game with the specified models.

    Requires exactly 7 model IDs (duplicates allowed for same-model matchups).
    The game runs asynchronously in the background.
    Returns immediately with a game ID that can be used to check status.
    """
    # Validate all models exist
    models = []
    for model_id in request.model_ids:
        model = db.query(Model).filter(Model.model_id == model_id).first()
        if not model:
            raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
        models.append(model)

    # Create game record
    game = Game(
        status=GameStatus.PENDING,
        webhook_url=request.webhook_url,
        engine_version=CURRENT_ENGINE_VERSION,
        model_ids=[m.id for m in models],
    )
    db.add(game)
    db.flush()

    # Schedule background task to run the game
    from app.services.game_runner import run_game_task

    background_tasks.add_task(run_game_task, game.id, [m.id for m in models])

    db.commit()

    return TriggerGameResponse(
        game_id=game.id,
        status=GameStatusEnum.PENDING,
    )


@router.post("/games/matchmake", response_model=TriggerGameResponse)
async def matchmake_game(
    request: MatchmakeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """
    Trigger a new game with matchmaking.

    Selects models with the fewest games played and assigns roles to balance experience.
    """
    from app.services.matchmaking import select_participants
    from app.services.game_runner import run_game_task

    # Select participants (returns UUIDs)
    # Impostors are first 2, Crewmates are next 5
    model_ids = select_participants(db)

    # Create game record
    game = Game(
        status=GameStatus.PENDING,
        webhook_url=request.webhook_url,
        engine_version=CURRENT_ENGINE_VERSION,
        model_ids=model_ids,
    )
    db.add(game)
    db.flush()

    # Schedule background task to run the game
    # randomize_roles=False keeps the order (Impostors first)
    background_tasks.add_task(run_game_task, game.id, model_ids, randomize_roles=False)

    db.commit()

    return TriggerGameResponse(
        game_id=game.id,
        status=GameStatusEnum.PENDING,
    )


@router.post("/games/trigger-bulk", response_model=BulkTriggerResponse)
async def trigger_bulk_games(
    request: BulkTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """
    Trigger multiple games in parallel.

    This endpoint runs games concurrently with a rate limit (semaphore),
    similar to the AmongLLMs/main.py approach. Much faster than triggering
    games one-by-one for bulk test runs or tournaments.

    Each game randomly selects 7 models from the pool. Default pool is all
    registered models; optionally override with specific model IDs.

    Args:
        request: Bulk trigger configuration
            - num_games: Number of games to run (1-100)
            - model_ids: Optional list to limit pool (default: all registered models)
            - rate_limit: Semaphore limit for max concurrent games (1-100, default: 50)
            - stream_logs: Enable live streaming (default: false, recommended for bulk)

    Returns:
        List of created game IDs and total count
    """
    import random

    # Default: use all registered models. Override: use only specified models.
    if request.model_ids:
        model_pool = request.model_ids
    else:
        all_models = db.query(Model).all()
        model_pool = [m.model_id for m in all_models]

    # Validate pool size
    if len(model_pool) < 7:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 7 models in pool, found {len(model_pool)}",
        )

    # Create games with randomly selected models from pool
    game_ids = []
    model_ids_list = []

    for _ in range(request.num_games):
        selected_model_ids = random.sample(model_pool, 7)

        # Validate and get Model objects
        models = []
        for model_id in selected_model_ids:
            model = db.query(Model).filter(Model.model_id == model_id).first()
            if not model:
                raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
            models.append(model)

        model_uuids = [m.id for m in models]

        # Create game record
        game = Game(
            status=GameStatus.PENDING,
            webhook_url=None,  # Bulk games don't support individual webhooks
            engine_version=CURRENT_ENGINE_VERSION,
            model_ids=model_uuids,
        )
        db.add(game)
        db.flush()
        game_ids.append(game.id)
        model_ids_list.append(model_uuids)

    db.commit()

    # Schedule bulk background task
    from app.services.game_runner import run_multiple_games_task

    background_tasks.add_task(
        run_multiple_games_task,
        game_ids=game_ids,
        model_ids_list=model_ids_list,
        rate_limit=request.rate_limit,
        randomize_roles=True,
        stream_logs=request.stream_logs,
    )

    return BulkTriggerResponse(
        game_ids=game_ids,
        total_games=request.num_games,
    )


@router.get("/games/{game_id}", response_model=GameResponse)
async def get_game(game_id: str, db: Session = Depends(get_db)):
    """
    Get the status and results of a game.

    Returns game details including participants and outcome if completed.
    """
    game = (
        db.query(Game)
        .options(joinedload(Game.participants).joinedload(GameParticipant.model))
        .filter(Game.id == game_id)
        .first()
    )
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Build participant responses
    participants = []
    for p in game.participants:
        participants.append(
            GameParticipantResponse(
                model_id=p.model.model_id,
                model_name=p.model.model_name,
                player_number=p.player_number,
                player_color=p.player_color,
                role=p.role.value,
                won=p.won,
                survived=p.survived,
            )
        )

    return GameResponse(
        game_id=game.id,
        status=GameStatusEnum(game.status.value),
        started_at=game.started_at,
        ended_at=game.ended_at,
        winner=game.winner,
        winner_reason=game.winner_reason,
        participants=participants,
        error_message=game.error_message,
        engine_version=game.engine_version,
    )


@router.get("/games", response_model=list[GameResponse])
async def list_games(
    status: GameStatusEnum | None = None,
    model_id: str | None = None,
    engine_version: int | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """
    List recent games, optionally filtered by status and/or model participation.

    Args:
        status: Filter by game status (pending, running, completed, failed)
        model_id: Filter to games where this model participated (uses model's model_id, not internal id)
        limit: Maximum number of games to return
    """
    query = (
        db.query(Game)
        .options(joinedload(Game.participants).joinedload(GameParticipant.model))
        .order_by(Game.created_at.desc())
    )

    if status:
        query = query.filter(Game.status == GameStatus(status.value))

    if engine_version is not None:
        query = query.filter(Game.engine_version == engine_version)

    if model_id:
        # Filter to games where the specified model participated
        query = query.join(GameParticipant).join(Model).filter(Model.model_id == model_id)

    games = query.limit(limit).all()

    results = []
    for game in games:
        participants = [
            GameParticipantResponse(
                model_id=p.model.model_id,
                model_name=p.model.model_name,
                player_number=p.player_number,
                player_color=p.player_color,
                role=p.role.value,
                won=p.won,
                survived=p.survived,
            )
            for p in game.participants
        ]

        results.append(
            GameResponse(
                game_id=game.id,
                status=GameStatusEnum(game.status.value),
                started_at=game.started_at,
                ended_at=game.ended_at,
                winner=game.winner,
                winner_reason=game.winner_reason,
                participants=participants,
                error_message=game.error_message,
                engine_version=game.engine_version,
            )
        )

    return results


@router.get("/games/{game_id}/logs", response_model=GameLogsResponse)
async def get_game_logs_endpoint(game_id: str, db: Session = Depends(get_db)):
    """
    Get the full game logs.

    Returns raw logs from S3 for client-side parsing.
    """
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if not game.log_bucket or not game.log_key:
        raise HTTPException(status_code=404, detail="Game logs not available")

    # Fetch logs from S3
    log_data = get_game_logs(game.log_bucket, game.log_key)
    if not log_data:
        raise HTTPException(status_code=404, detail="Failed to retrieve game logs")

    return GameLogsResponse(
        game_id=game_id,
        agent_logs=log_data.get("agent_logs", []),
        summary=log_data.get("summary"),
    )


@router.get("/games/{game_id}/stream")
async def stream_game_logs(game_id: str, db: Session = Depends(get_db)):
    """
    Stream live game logs via Server-Sent Events (SSE).

    Returns a stream of log entries as they happen during game execution.
    Events:
    - "log": A new log entry from the game
    - "end": Game has completed, includes summary

    Returns 400 if game is not currently running/streaming.
    """
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Only allow streaming for games that are pending or running
    if game.status not in (GameStatus.PENDING, GameStatus.RUNNING):
        raise HTTPException(
            status_code=400,
            detail=f"Game is not streaming (status: {game.status.value})",
        )

    # Check if we have a live stream for this game
    if not live_logs.is_streaming(game_id) and game.status != GameStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Live stream not available for this game",
        )

    async def event_generator():
        """Generate SSE events from the live log stream."""
        async for event_type, data in live_logs.subscribe(game_id):
            # Format as SSE: event type + JSON data
            yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


class MarkGameFailedRequest(BaseModel):
    """Request to mark a game as failed."""

    error_message: str = Field(
        ..., description="Error message explaining why the game failed validation"
    )


@router.patch("/games/{game_id}/fail", status_code=200)
async def mark_game_failed(
    game_id: str,
    request: MarkGameFailedRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """
    Mark a game as failed with an error message.

    This is used for games that completed but failed validation
    (e.g., truncated LLM responses, missing actions, etc.).
    Failed games are excluded from ratings calculations.
    Requires API key authentication.
    """
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    game.status = GameStatus.FAILED
    game.error_message = request.error_message
    db.commit()

    return {"game_id": game_id, "status": "failed", "error_message": request.error_message}


@router.delete("/games/{game_id}", status_code=204)
async def delete_game(
    game_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """
    Delete a game and its associated logs.

    Requires API key authentication.
    """
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Delete logs from S3 if they exist
    if game.log_bucket and game.log_key:
        delete_game_logs(game.log_bucket, game.log_key)

    # Delete game (cascades to participants)
    db.delete(game)
    db.commit()


@router.delete("/games", status_code=200)
async def delete_all_games(
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """
    Delete ALL games and their associated logs.

    Use with caution! Requires API key authentication.
    Returns the count of deleted games.
    """
    games = db.query(Game).all()
    count = len(games)

    for game in games:
        # Delete logs from S3 if they exist
        if game.log_bucket and game.log_key:
            delete_game_logs(game.log_bucket, game.log_key)
        db.delete(game)

    db.commit()

    return {"deleted": count}
