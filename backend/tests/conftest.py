"""Pytest fixtures for testing."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models import Model, Game, GameParticipant, PlayerRole, GameStatus


@pytest.fixture
def db_engine():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture
def db_session(db_engine):
    """Create a database session for testing."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def sample_models(db_session):
    """Create sample models for testing."""
    models = []
    model_data = [
        ("claude-opus-4", "Claude Opus 4", "Anthropic", "anthropic/claude-opus-4"),
        ("gpt-5", "GPT-5", "OpenAI", "openai/gpt-5"),
        ("gemini-3", "Gemini 3 Ultra", "Google", "google/gemini-3-ultra"),
        ("llama-4", "Llama 4 405B", "Meta", "meta/llama-4-405b"),
        ("mistral-large", "Mistral Large 3", "Mistral", "mistral/mistral-large-3"),
        ("claude-sonnet", "Claude Sonnet 4", "Anthropic", "anthropic/claude-sonnet-4"),
        ("gpt-4-turbo", "GPT-4 Turbo", "OpenAI", "openai/gpt-4-turbo"),
    ]

    for model_id, name, provider, openrouter_id in model_data:
        model = Model(
            model_id=model_id,
            model_name=name,
            provider=provider,
            openrouter_id=openrouter_id,
            avatar_color="#FF0000",
        )
        db_session.add(model)
        models.append(model)

    db_session.commit()
    return models


@pytest.fixture
def sample_game_with_participants(db_session, sample_models):
    """Create a sample game with 7 participants (2 impostors, 5 crewmates).

    Impostors win (winner=1), so impostor participants have won=True.
    """
    game = Game(status=GameStatus.COMPLETED, winner=1, winner_reason="Impostors win!")

    db_session.add(game)
    db_session.flush()

    colors = ["red", "blue", "green", "yellow", "purple", "orange", "pink"]

    # First 2 models are impostors, rest are crewmates
    # Impostors won (winner=1), so impostors have won=True
    for i, model in enumerate(sample_models):
        role = PlayerRole.IMPOSTOR if i < 2 else PlayerRole.CREWMATE
        won = role == PlayerRole.IMPOSTOR  # Impostors won this game
        participant = GameParticipant(
            game_id=game.id,
            model_id=model.id,
            player_number=i + 1,
            player_color=colors[i],
            role=role,
            won=won,
        )
        db_session.add(participant)

    db_session.commit()
    db_session.refresh(game)
    return game
