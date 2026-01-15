"""Tests for API endpoints using FastAPI TestClient."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models import Model, ModelRating, Game, GameParticipant, GameStatus, PlayerRole


# Create a test engine with StaticPool for in-memory SQLite
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


def override_get_db():
    """Override database dependency with test database."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Apply the override globally for this test module
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    """Set up and tear down the test database for each test."""
    # Create all tables
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    # Drop all tables after test
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def db_session():
    """Get a database session for test setup."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def sample_model(db_session):
    """Create a sample model in the test database."""
    model = Model(
        model_id="claude-opus-4",
        model_name="Claude Opus 4",
        provider="Anthropic",
        openrouter_id="anthropic/claude-opus-4",
        avatar_color="#FF6B6B",
    )
    db_session.add(model)
    db_session.flush()

    rating = ModelRating(model_id=model.id)
    db_session.add(rating)
    model.ratings = rating

    db_session.commit()
    db_session.refresh(model)
    return model


@pytest.fixture
def seven_models(db_session):
    """Create 7 models for game testing."""
    model_data = [
        ("claude-opus-4", "Claude Opus 4", "Anthropic", "anthropic/claude-opus-4"),
        ("gpt-5", "GPT-5", "OpenAI", "openai/gpt-5"),
        ("gemini-3", "Gemini 3 Ultra", "Google", "google/gemini-3-ultra"),
        ("llama-4", "Llama 4 405B", "Meta", "meta/llama-4-405b"),
        ("mistral-large", "Mistral Large 3", "Mistral", "mistral/mistral-large-3"),
        ("claude-sonnet", "Claude Sonnet 4", "Anthropic", "anthropic/claude-sonnet-4"),
        ("gpt-4-turbo", "GPT-4 Turbo", "OpenAI", "openai/gpt-4-turbo"),
    ]

    models = []
    for model_id, name, provider, openrouter_id in model_data:
        model = Model(
            model_id=model_id,
            model_name=name,
            provider=provider,
            openrouter_id=openrouter_id,
            avatar_color="#FF0000",
        )
        db_session.add(model)
        db_session.flush()

        rating = ModelRating(model_id=model.id)
        db_session.add(rating)
        model.ratings = rating
        models.append(model)

    db_session.commit()
    return models


class TestHealthEndpoint:
    """Tests for the health check endpoint."""

    def test_health_returns_200(self, client):
        """Health endpoint should return 200 OK."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


class TestLeaderboardEndpoint:
    """Tests for GET /api/leaderboard."""

    def test_empty_leaderboard(self, client):
        """Should return empty leaderboard when no models exist."""
        response = client.get("/api/leaderboard")

        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []
        assert data["total"] == 0
        assert data["page"] == 1
        assert data["total_pages"] == 0

    def test_leaderboard_with_models(self, client, sample_model):
        """Should return models ranked by rating."""
        response = client.get("/api/leaderboard")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["data"]) == 1
        assert data["data"][0]["model_id"] == "claude-opus-4"
        assert data["data"][0]["model_name"] == "Claude Opus 4"
        assert data["data"][0]["overall_rating"] == 2500  # Default mu * 100

    def test_leaderboard_pagination(self, client, seven_models):
        """Should paginate results correctly."""
        response = client.get("/api/leaderboard?page=1&per_page=3")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 7
        assert len(data["data"]) == 3
        assert data["page"] == 1
        assert data["per_page"] == 3
        assert data["total_pages"] == 3

    def test_leaderboard_second_page(self, client, seven_models):
        """Should return correct items on second page."""
        response = client.get("/api/leaderboard?page=2&per_page=3")

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 3
        assert data["page"] == 2

    def test_leaderboard_invalid_page(self, client):
        """Should reject invalid page numbers."""
        response = client.get("/api/leaderboard?page=0")
        assert response.status_code == 422  # Validation error

    def test_leaderboard_response_schema(self, client, sample_model):
        """Should include all required fields in response."""
        response = client.get("/api/leaderboard")
        data = response.json()
        model_data = data["data"][0]

        required_fields = [
            "model_id", "model_name", "provider", "overall_rating",
            "impostor_rating", "crewmate_rating", "games_played",
            "current_rank", "previous_rank", "rank_change",
            "release_date", "avatar_color"
        ]

        for field in required_fields:
            assert field in model_data, f"Missing field: {field}"


class TestModelsEndpoint:
    """Tests for /api/models endpoints."""

    def test_create_model(self, client):
        """Should create a new model."""
        response = client.post("/api/models", json={
            "model_id": "new-model",
            "model_name": "New Model",
            "provider": "Test Corp",
            "openrouter_id": "test/new-model",
            "avatar_color": "#123456",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["model_id"] == "new-model"
        assert data["model_name"] == "New Model"
        assert data["provider"] == "Test Corp"

    def test_create_duplicate_model(self, client, sample_model):
        """Should reject duplicate model IDs."""
        response = client.post("/api/models", json={
            "model_id": "claude-opus-4",  # Already exists
            "model_name": "Duplicate",
            "provider": "Test",
            "openrouter_id": "test/duplicate",
        })

        assert response.status_code == 409

    def test_list_models(self, client, seven_models):
        """Should list all registered models."""
        response = client.get("/api/models")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 7

    def test_get_model(self, client, sample_model):
        """Should get a specific model by ID."""
        response = client.get("/api/models/claude-opus-4")

        assert response.status_code == 200
        data = response.json()
        assert data["model_id"] == "claude-opus-4"
        assert data["model_name"] == "Claude Opus 4"

    def test_get_nonexistent_model(self, client):
        """Should return 404 for nonexistent model."""
        response = client.get("/api/models/nonexistent")
        assert response.status_code == 404

    def test_delete_model(self, client, sample_model):
        """Should delete a model."""
        response = client.delete("/api/models/claude-opus-4")
        assert response.status_code == 204

        # Verify it's gone
        response = client.get("/api/models/claude-opus-4")
        assert response.status_code == 404

    def test_delete_nonexistent_model(self, client):
        """Should return 404 when deleting nonexistent model."""
        response = client.delete("/api/models/nonexistent")
        assert response.status_code == 404


class TestGamesEndpoint:
    """Tests for /api/games endpoints."""

    def test_trigger_game_validates_model_count(self, client, sample_model):
        """Should require exactly 7 models."""
        response = client.post("/api/games/trigger", json={
            "model_ids": ["claude-opus-4"]  # Only 1 model
        })

        assert response.status_code == 422  # Validation error

    def test_trigger_game_validates_models_exist(self, client, seven_models):
        """Should validate all models exist."""
        model_ids = [m.model_id for m in seven_models[:6]]
        model_ids.append("nonexistent-model")

        response = client.post("/api/games/trigger", json={
            "model_ids": model_ids
        })

        assert response.status_code == 404
        assert "nonexistent-model" in response.json()["detail"]

    def test_trigger_game_creates_game(self, client, db_session, seven_models):
        """Should create a game and return game ID."""
        model_ids = [m.model_id for m in seven_models]

        response = client.post("/api/games/trigger", json={
            "model_ids": model_ids
        })

        assert response.status_code == 200
        data = response.json()
        assert "game_id" in data
        assert data["status"] == "pending"

        # Verify game was created in database (need fresh session to see it)
        db_session.expire_all()
        game = db_session.query(Game).filter(Game.id == data["game_id"]).first()
        assert game is not None
        assert game.status == GameStatus.PENDING

    def test_get_game_not_found(self, client):
        """Should return 404 for nonexistent game."""
        response = client.get("/api/games/nonexistent-game-id")
        assert response.status_code == 404

    def test_get_game(self, client, db_session, seven_models):
        """Should return game details."""
        # Create a game directly
        game = Game(status=GameStatus.COMPLETED, winner=1, winner_reason="Test win")
        db_session.add(game)
        db_session.flush()

        # Add participants
        colors = ["red", "blue", "green", "yellow", "purple", "orange", "pink"]
        for i, model in enumerate(seven_models):
            role = PlayerRole.IMPOSTOR if i < 2 else PlayerRole.CREWMATE
            participant = GameParticipant(
                game_id=game.id,
                model_id=model.id,
                player_number=i + 1,
                player_color=colors[i],
                role=role,
                won=(i < 2),  # Impostors won
            )
            db_session.add(participant)

        db_session.commit()

        response = client.get(f"/api/games/{game.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["game_id"] == game.id
        assert data["status"] == "completed"
        assert data["winner"] == 1
        assert len(data["participants"]) == 7

    def test_list_games_empty(self, client):
        """Should return empty list when no games exist."""
        response = client.get("/api/games")

        assert response.status_code == 200
        assert response.json() == []

    def test_list_games(self, client, db_session):
        """Should list recent games."""
        # Create a few games
        for i in range(3):
            game = Game(status=GameStatus.COMPLETED, winner=1)
            db_session.add(game)
        db_session.commit()

        response = client.get("/api/games")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_list_games_filter_by_status(self, client, db_session):
        """Should filter games by status."""
        # Create games with different statuses
        db_session.add(Game(status=GameStatus.COMPLETED, winner=1))
        db_session.add(Game(status=GameStatus.COMPLETED, winner=2))
        db_session.add(Game(status=GameStatus.PENDING))
        db_session.commit()

        response = client.get("/api/games?status=completed")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert all(g["status"] == "completed" for g in data)
