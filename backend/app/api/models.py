from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_api_key
from app.api.schemas import ModelCreateRequest, ModelResponse, ModelUpdateRequest
from app.core.database import get_db
from app.models import Game, GameParticipant, Model, ModelRating

router = APIRouter(tags=["models"])


@router.post("/models", response_model=ModelResponse, status_code=201)
async def create_model(
    request: ModelCreateRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """
    Register a new model in the leaderboard.

    Creates a model with default ratings (2500 starting rating).
    """
    # Check if model_id already exists
    existing = db.query(Model).filter(Model.model_id == request.model_id).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Model already exists: {request.model_id}")

    # Create the model
    model = Model(
        model_id=request.model_id,
        model_name=request.model_name,
        provider=request.provider,
        openrouter_id=request.openrouter_id,
        release_date=request.release_date,
        avatar_color=request.avatar_color,
    )
    db.add(model)
    db.flush()

    # Create initial rating
    rating = ModelRating(model_id=model.id)
    db.add(rating)

    db.commit()
    db.refresh(model)

    return ModelResponse(
        model_id=model.model_id,
        model_name=model.model_name,
        provider=model.provider,
        openrouter_id=model.openrouter_id,
        release_date=model.release_date,
        avatar_color=model.avatar_color,
        games_played_by_season={},
    )


@router.get("/models", response_model=list[ModelResponse])
async def list_models(db: Session = Depends(get_db)):
    """List all registered models."""
    models = db.query(Model).order_by(Model.model_name).all()

    # Pre-fetch games played counts by season
    # Result: [(model_uuid, engine_version, count), ...]
    counts = (
        db.query(
            GameParticipant.model_id,
            Game.engine_version,
            func.count(GameParticipant.game_id),
        )
        .join(Game, Game.id == GameParticipant.game_id)
        .group_by(GameParticipant.model_id, Game.engine_version)
        .all()
    )

    # Map model_uuid -> season -> count
    stats_map: dict[str, dict[int, int]] = {}
    for mid, season, count in counts:
        if mid not in stats_map:
            stats_map[mid] = {}
        stats_map[mid][season] = count

    return [
        ModelResponse(
            model_id=m.model_id,
            model_name=m.model_name,
            provider=m.provider,
            openrouter_id=m.openrouter_id,
            release_date=m.release_date,
            avatar_color=m.avatar_color,
            games_played_by_season=stats_map.get(m.id, {}),
        )
        for m in models
    ]


@router.get("/models/{model_id}", response_model=ModelResponse)
async def get_model(model_id: str, db: Session = Depends(get_db)):
    """Get a specific model by ID."""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Fetch game counts
    counts = (
        db.query(Game.engine_version, func.count(GameParticipant.game_id))
        .join(GameParticipant, Game.id == GameParticipant.game_id)
        .filter(GameParticipant.model_id == model.id)
        .group_by(Game.engine_version)
        .all()
    )
    games_played_by_season = {season: count for season, count in counts}

    return ModelResponse(
        model_id=model.model_id,
        model_name=model.model_name,
        provider=model.provider,
        openrouter_id=model.openrouter_id,
        release_date=model.release_date,
        avatar_color=model.avatar_color,
        games_played_by_season=games_played_by_season,
    )


@router.patch("/models/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: str,
    request: ModelUpdateRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """Update an existing model's details."""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Update only provided fields
    if request.model_name is not None:
        model.model_name = request.model_name
    if request.provider is not None:
        model.provider = request.provider
    if request.openrouter_id is not None:
        model.openrouter_id = request.openrouter_id
    if request.release_date is not None:
        model.release_date = request.release_date
    if request.avatar_color is not None:
        model.avatar_color = request.avatar_color

    db.commit()
    db.refresh(model)

    # Fetch game counts
    counts = (
        db.query(Game.engine_version, func.count(GameParticipant.game_id))
        .join(GameParticipant, Game.id == GameParticipant.game_id)
        .filter(GameParticipant.model_id == model.id)
        .group_by(Game.engine_version)
        .all()
    )
    games_played_by_season = {season: count for season, count in counts}

    return ModelResponse(
        model_id=model.model_id,
        model_name=model.model_name,
        provider=model.provider,
        openrouter_id=model.openrouter_id,
        release_date=model.release_date,
        avatar_color=model.avatar_color,
        games_played_by_season=games_played_by_season,
    )


@router.delete("/models/{model_id}", status_code=204)
async def delete_model(
    model_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """Delete a model from the registry."""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    db.delete(model)
    db.commit()


@router.post("/ratings/recalculate", status_code=200)
async def recalculate_all_ratings(
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """
    Recalculate ALL model ratings from game history.

    Resets ratings to defaults, then replays all completed games chronologically
    to rebuild accurate ratings. Use after deleting games.

    Requires API key authentication.
    """
    from app.models import Game, GameStatus
    from app.services.rating_service import update_ratings_for_game

    ratings = db.query(ModelRating).all()
    models_reset = len(ratings)

    # Reset all ratings to OpenSkill defaults
    for rating in ratings:
        rating.reset_to_defaults()

    db.flush()

    # Get all completed games in chronological order for the current season.
    # Only games with engine_version matching CURRENT_ENGINE_VERSION are included;
    # older seasons are excluded to keep ratings comparable.
    from app.core.constants import CURRENT_ENGINE_VERSION

    completed_games = (
        db.query(Game)
        .filter(
            Game.status == GameStatus.COMPLETED,
            Game.engine_version == CURRENT_ENGINE_VERSION,
        )
        .order_by(Game.ended_at.asc())
        .all()
    )

    # Count excluded games for the response
    excluded_games = (
        db.query(Game)
        .filter(
            Game.status == GameStatus.COMPLETED,
            Game.engine_version != CURRENT_ENGINE_VERSION,
        )
        .count()
    )

    # Replay each game to rebuild ratings
    for game in completed_games:
        update_ratings_for_game(db, game)

    db.commit()

    return {
        "models_reset": models_reset,
        "games_processed": len(completed_games),
        "games_excluded": excluded_games,
    }
