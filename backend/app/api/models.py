from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import ModelCreateRequest, ModelResponse
from app.core.database import get_db
from app.models import Model, ModelRating

router = APIRouter(tags=["models"])


@router.post("/models", response_model=ModelResponse, status_code=201)
async def create_model(request: ModelCreateRequest, db: Session = Depends(get_db)):
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
    )


@router.get("/models", response_model=list[ModelResponse])
async def list_models(db: Session = Depends(get_db)):
    """List all registered models."""
    models = db.query(Model).order_by(Model.model_name).all()

    return [
        ModelResponse(
            model_id=m.model_id,
            model_name=m.model_name,
            provider=m.provider,
            openrouter_id=m.openrouter_id,
            release_date=m.release_date,
            avatar_color=m.avatar_color,
        )
        for m in models
    ]


@router.get("/models/{model_id}", response_model=ModelResponse)
async def get_model(model_id: str, db: Session = Depends(get_db)):
    """Get a specific model by ID."""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    return ModelResponse(
        model_id=model.model_id,
        model_name=model.model_name,
        provider=model.provider,
        openrouter_id=model.openrouter_id,
        release_date=model.release_date,
        avatar_color=model.avatar_color,
    )


@router.delete("/models/{model_id}", status_code=204)
async def delete_model(model_id: str, db: Session = Depends(get_db)):
    """Delete a model from the registry."""
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    db.delete(model)
    db.commit()
