
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_api_key
from app.api.schemas import (
    TriggerGameRequest,
    TriggerGameResponse,
    GameResponse,
    GameParticipantResponse,
    GameStatusEnum,
)
from app.core.database import get_db
from app.models import Game, GameStatus, Model
from app.services.storage_service import generate_presigned_url

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

    Requires exactly 7 model IDs. The game runs asynchronously in the background.
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
    game = db.query(Game).filter(Game.id == game_id).first()
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

    # Generate presigned URL for logs if available
    log_url = None
    if game.log_bucket and game.log_key:
        log_url = generate_presigned_url(game.log_bucket, game.log_key)

    return GameResponse(
        game_id=game.id,
        status=GameStatusEnum(game.status.value),
        started_at=game.started_at,
        ended_at=game.ended_at,
        winner=game.winner,
        winner_reason=game.winner_reason,
        participants=participants,
        log_url=log_url,
        error_message=game.error_message,
    )


@router.get("/games", response_model=list[GameResponse])
async def list_games(
    status: GameStatusEnum | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """
    List recent games, optionally filtered by status.
    """
    query = db.query(Game).order_by(Game.created_at.desc())

    if status:
        query = query.filter(Game.status == GameStatus(status.value))

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

        log_url = None
        if game.log_bucket and game.log_key:
            log_url = generate_presigned_url(game.log_bucket, game.log_key)

        results.append(
            GameResponse(
                game_id=game.id,
                status=GameStatusEnum(game.status.value),
                started_at=game.started_at,
                ended_at=game.ended_at,
                winner=game.winner,
                winner_reason=game.winner_reason,
                participants=participants,
                log_url=log_url,
                error_message=game.error_message,
            )
        )

    return results
