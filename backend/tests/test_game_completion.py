"""
End-to-end tests for game completion flow.

Tests that when a game completes:
1. Participants are created from the game summary
2. Ratings are updated correctly
3. The game status is set to completed

This covers the bug where participants weren't flushed before rating calculation,
causing "teams must have at least 1 player" errors.
"""

import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models import Game, Model, ModelRating, GameStatus, PlayerRole
from app.services.game_runner import run_game_async, GameResult


# Create a test engine
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


@pytest.fixture
def db_session():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def seven_models(db_session):
    """Create 7 models with ratings for game testing."""
    model_data = [
        ("mistral-large-2512", "Mistral Large", "Mistral", "mistralai/mistral-large-2512"),
        ("llama-3.3-70b", "Llama 3.3 70B", "Meta", "meta-llama/llama-3.3-70b-instruct"),
        ("gpt-5-mini", "GPT-5 Mini", "OpenAI", "openai/gpt-5-mini"),
        ("kimi-k2.5", "Kimi K2.5", "Moonshot", "moonshotai/kimi-k2.5"),
        ("qwen3-235b", "Qwen3 235B", "Alibaba", "qwen/qwen3-235b-a22b-2507"),
        ("gemini-3-flash", "Gemini 3 Flash", "Google", "google/gemini-3-flash-preview"),
        ("deepseek-r1", "DeepSeek R1", "DeepSeek", "deepseek/deepseek-r1-0528"),
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


def create_mock_game_summary(models: list[Model]) -> dict:
    """
    Create a mock game summary that matches the amongagents output format.

    Assigns first 2 models as impostors, rest as crewmates.
    Impostors win (winner=1).
    """
    colors = ["green", "black", "lime", "yellow", "brown", "purple", "white"]

    summary = {
        "config": {
            "num_players": 7,
            "num_impostors": 2,
        },
        "winner": 1,
        "winner_reason": "Impostors win! (Crewmates outnumbered)",
    }

    for i, model in enumerate(models):
        player_num = i + 1
        identity = "Impostor" if i < 2 else "Crewmate"
        summary[f"Player {player_num}"] = {
            "name": f"Player {player_num}: {colors[i]}",
            "color": colors[i],
            "identity": identity,
            "model": model.openrouter_id,
            "personality": None,
            "tasks": ["Fix Wiring"],
        }

    return summary


class TestGameCompletionFlow:
    """Tests for the complete game flow from start to finish."""

    @pytest.mark.asyncio
    async def test_game_completion_creates_participants(self, db_session, seven_models):
        """
        When a game completes, participants should be created from the summary.

        This test verifies the fix for the bug where participants weren't
        flushed before rating calculation.
        """
        # Create a pending game
        game = Game(status=GameStatus.PENDING)
        db_session.add(game)
        db_session.commit()

        game_id = game.id
        model_ids = [m.id for m in seven_models]

        # Create mock summary
        mock_summary = create_mock_game_summary(seven_models)

        # Mock the dependencies
        with (
            patch("app.services.game_runner.SessionLocal") as mock_session_local,
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            # Configure mocks
            mock_session_local.return_value = db_session
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = GameResult(
                winner=1,
                winner_reason="Impostors win! (Crewmates outnumbered)",
                summary=mock_summary,
                agent_logs=[],
                experiment_dir="/tmp/test",
            )
            mock_upload.return_value = ("test-bucket", "test-key")

            # Run the game
            await run_game_async(game_id, model_ids)

        # Refresh the game from DB
        db_session.expire_all()
        game = db_session.query(Game).filter(Game.id == game_id).first()

        # Verify game completed
        assert game.status == GameStatus.COMPLETED
        assert game.winner == 1

        # Verify participants were created
        assert len(game.participants) == 7

        # Verify participant data is correct
        impostors = [p for p in game.participants if p.role == PlayerRole.IMPOSTOR]
        crewmates = [p for p in game.participants if p.role == PlayerRole.CREWMATE]

        assert len(impostors) == 2
        assert len(crewmates) == 5

        # Verify won status
        for p in impostors:
            assert p.won is True
        for p in crewmates:
            assert p.won is False

        # Verify colors from summary
        colors_in_db = {p.player_number: p.player_color for p in game.participants}
        assert colors_in_db[1] == "green"
        assert colors_in_db[3] == "lime"
        assert colors_in_db[7] == "white"

    @pytest.mark.asyncio
    async def test_game_completion_updates_ratings(self, db_session, seven_models):
        """
        When a game completes, ratings should be updated for all participants.
        """
        # Create a pending game
        game = Game(status=GameStatus.PENDING)
        db_session.add(game)
        db_session.commit()

        game_id = game.id
        model_ids = [m.id for m in seven_models]

        # Record initial ratings (store by id since models may get detached)
        initial_ratings = {}
        for model in seven_models:
            initial_ratings[model.id] = {
                "impostor_mu": model.ratings.impostor_mu,
                "crewmate_mu": model.ratings.crewmate_mu,
            }

        # Create mock summary
        mock_summary = create_mock_game_summary(seven_models)

        with (
            patch("app.services.game_runner.SessionLocal") as mock_session_local,
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            mock_session_local.return_value = db_session
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = GameResult(
                winner=1,
                winner_reason="Impostors win!",
                summary=mock_summary,
                agent_logs=[],
                experiment_dir="/tmp/test",
            )
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_game_async(game_id, model_ids)

        # Refresh models
        db_session.expire_all()

        # Verify ratings changed (re-query each model by stored id)
        for i, model_id in enumerate(model_ids):
            model = db_session.query(Model).filter(Model.id == model_id).first()

            if i < 2:  # Impostors (won)
                # Impostor rating should increase
                assert model.ratings.impostor_mu > initial_ratings[model_id]["impostor_mu"]
                assert model.ratings.impostor_games == 1
            else:  # Crewmates (lost)
                # Crewmate rating should decrease
                assert model.ratings.crewmate_mu < initial_ratings[model_id]["crewmate_mu"]
                assert model.ratings.crewmate_games == 1

    @pytest.mark.asyncio
    async def test_game_failure_on_invalid_summary(self, db_session, seven_models):
        """
        If the game summary is missing required fields, the game should fail gracefully.
        """
        game = Game(status=GameStatus.PENDING)
        db_session.add(game)
        db_session.commit()

        game_id = game.id
        model_ids = [m.id for m in seven_models]

        # Create an invalid summary (missing Player 3)
        mock_summary = create_mock_game_summary(seven_models)
        del mock_summary["Player 3"]

        with (
            patch("app.services.game_runner.SessionLocal") as mock_session_local,
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            mock_session_local.return_value = db_session
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = GameResult(
                winner=1,
                winner_reason="Impostors win!",
                summary=mock_summary,
                agent_logs=[],
                experiment_dir="/tmp/test",
            )
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_game_async(game_id, model_ids)

        db_session.expire_all()
        game = db_session.query(Game).filter(Game.id == game_id).first()

        # Game should be marked as failed
        assert game.status == GameStatus.FAILED
        assert "Missing Player 3" in game.error_message

    @pytest.mark.asyncio
    async def test_crewmate_win_updates_ratings_correctly(self, db_session, seven_models):
        """
        When crewmates win, their ratings should increase and impostor ratings decrease.
        """
        game = Game(status=GameStatus.PENDING)
        db_session.add(game)
        db_session.commit()

        game_id = game.id
        model_ids = [m.id for m in seven_models]

        # Record initial ratings (store by id since models may get detached)
        initial_impostor_mus = {m.id: m.ratings.impostor_mu for m in seven_models[:2]}
        initial_crewmate_mus = {m.id: m.ratings.crewmate_mu for m in seven_models[2:]}

        # Create mock summary where crewmates win
        mock_summary = create_mock_game_summary(seven_models)
        mock_summary["winner"] = 2  # Crewmates win
        mock_summary["winner_reason"] = "Crewmates win! (All impostors eliminated)"

        with (
            patch("app.services.game_runner.SessionLocal") as mock_session_local,
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            mock_session_local.return_value = db_session
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = GameResult(
                winner=2,
                winner_reason="Crewmates win! (All impostors eliminated)",
                summary=mock_summary,
                agent_logs=[],
                experiment_dir="/tmp/test",
            )
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_game_async(game_id, model_ids)

        db_session.expire_all()

        # Verify impostor ratings decreased (they lost) - query by stored id
        for model_id in list(initial_impostor_mus.keys()):
            model = db_session.query(Model).filter(Model.id == model_id).first()
            assert model.ratings.impostor_mu < initial_impostor_mus[model_id]

        # Verify crewmate ratings increased (they won) - query by stored id
        for model_id in list(initial_crewmate_mus.keys()):
            model = db_session.query(Model).filter(Model.id == model_id).first()
            assert model.ratings.crewmate_mu > initial_crewmate_mus[model_id]
