import json

from pydantic import BaseModel, Field

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_api_key
from app.api.schemas import (
    TriggerGameRequest,
    TriggerGameResponse,
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
