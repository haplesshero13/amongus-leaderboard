"""
Integration tests for the bulk game runner (run_multiple_games_async).

These tests exercise the full Phase 1 → Phase 2 → Phase 3 flow with mocked
I/O (game execution, log uploads, settings) and a real in-memory SQLite DB.

They validate:
  - All games transition to COMPLETED or FAILED (none stuck in RUNNING)
  - _prepare_game correctly marks games RUNNING in Phase 1
  - Results are saved correctly per-game (not batch-at-end)
  - DB connections are opened/closed properly (no leaks)
  - Errors in individual games don't crash the whole batch
  - Rating updates are applied for completed games
"""

import asyncio

import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models import Game, Model, ModelRating, GameStatus, PlayerRole
from app.services.game_runner import (
    run_multiple_games_async,
    GameResult,
)


# Create a test engine (shared across all tests in this module)
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
        ("model-a", "Model A", "Provider A", "provider-a/model-a"),
        ("model-b", "Model B", "Provider B", "provider-b/model-b"),
        ("model-c", "Model C", "Provider C", "provider-c/model-c"),
        ("model-d", "Model D", "Provider D", "provider-d/model-d"),
        ("model-e", "Model E", "Provider E", "provider-e/model-e"),
        ("model-f", "Model F", "Provider F", "provider-f/model-f"),
        ("model-g", "Model G", "Provider G", "provider-g/model-g"),
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


def _make_summary(models: list[Model], winner: int = 1) -> dict:
    """Build a mock game summary matching the amongagents output format."""
    colors = ["red", "blue", "green", "yellow", "purple", "orange", "white"]
    summary = {
        "config": {"num_players": 7, "num_impostors": 2},
        "winner": winner,
        "winner_reason": (
            "Impostors win! (Crewmates outnumbered)"
            if winner in (1, 4)
            else "Crewmates win! (All impostors eliminated)"
        ),
    }
    for i, model in enumerate(models):
        identity = "Impostor" if i < 2 else "Crewmate"
        summary[f"Player {i + 1}"] = {
            "name": f"Player {i + 1}: {colors[i]}",
            "color": colors[i],
            "identity": identity,
            "model": model.openrouter_id,
            "personality": None,
            "tasks": ["Fix Wiring"],
        }
    return summary


def _make_game_result(models: list[Model], winner: int = 1) -> GameResult:
    """Build a mock GameResult for a successful game."""
    return GameResult(
        winner=winner,
        winner_reason="Impostors win! (Crewmates outnumbered)",
        summary=_make_summary(models, winner),
        agent_logs=[],
        experiment_dir="/tmp/fake",
    )


def _create_pending_games(
    db_session, seven_models, count: int
) -> tuple[list[str], list[list[str]]]:
    """Create N pending games in the DB. Returns (game_ids, model_ids_list)."""
    game_ids = []
    model_ids_list = []
    model_uuids = [m.id for m in seven_models]

    for _ in range(count):
        game = Game(status=GameStatus.PENDING)
        db_session.add(game)
        db_session.flush()
        game_ids.append(game.id)
        model_ids_list.append(list(model_uuids))

    db_session.commit()
    return game_ids, model_ids_list


class TestBulkRunnerHappyPath:
    """Tests for the happy path where all games succeed."""

    @pytest.mark.asyncio
    async def test_all_games_complete(self, db_session, seven_models):
        """All games should transition PENDING → RUNNING → COMPLETED."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 3)
        result = _make_game_result(seven_models)

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = result
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()

        for game_id in game_ids:
            game = db_session.query(Game).filter(Game.id == game_id).first()
            assert game.status == GameStatus.COMPLETED, f"Game {game_id} is {game.status}"
            assert game.winner == 1
            assert len(game.participants) == 7

    @pytest.mark.asyncio
    async def test_participants_created_with_correct_roles(self, db_session, seven_models):
        """Participants should have correct roles, colors, and win status."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 1)
        result = _make_game_result(seven_models)

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = result
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()
        game = db_session.query(Game).filter(Game.id == game_ids[0]).first()

        impostors = [p for p in game.participants if p.role == PlayerRole.IMPOSTOR]
        crewmates = [p for p in game.participants if p.role == PlayerRole.CREWMATE]

        assert len(impostors) == 2
        assert len(crewmates) == 5

        # Impostors won (winner=1)
        for p in impostors:
            assert p.won is True
        for p in crewmates:
            assert p.won is False

    @pytest.mark.asyncio
    async def test_ratings_updated(self, db_session, seven_models):
        """Ratings should be updated for all participants after game completion."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 1)
        result = _make_game_result(seven_models)

        initial_impostor_mus = {m.id: m.ratings.impostor_mu for m in seven_models[:2]}
        initial_crewmate_mus = {m.id: m.ratings.crewmate_mu for m in seven_models[2:]}

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = result
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()

        for model_id, initial_mu in initial_impostor_mus.items():
            model = db_session.query(Model).filter(Model.id == model_id).first()
            assert model.ratings.impostor_mu > initial_mu  # Won → rating increased
            assert model.ratings.impostor_games == 1

        for model_id, initial_mu in initial_crewmate_mus.items():
            model = db_session.query(Model).filter(Model.id == model_id).first()
            assert model.ratings.crewmate_mu < initial_mu  # Lost → rating decreased
            assert model.ratings.crewmate_games == 1


class TestBulkRunnerErrorHandling:
    """Tests for error handling: partial failures, timeouts, exceptions."""

    @pytest.mark.asyncio
    async def test_one_game_fails_others_succeed(self, db_session, seven_models):
        """If one game raises, the other games should still complete."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 3)
        successful_result = _make_game_result(seven_models)

        call_count = 0

        async def mock_execute(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise RuntimeError("Game engine exploded")
            return successful_result

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game", side_effect=mock_execute),
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()

        statuses = []
        for game_id in game_ids:
            game = db_session.query(Game).filter(Game.id == game_id).first()
            statuses.append(game.status)

        completed = sum(1 for s in statuses if s == GameStatus.COMPLETED)
        failed = sum(1 for s in statuses if s == GameStatus.FAILED)

        assert completed == 2, f"Expected 2 completed, got {completed}"
        assert failed == 1, f"Expected 1 failed, got {failed}"

        # No games stuck in RUNNING
        running = sum(1 for s in statuses if s == GameStatus.RUNNING)
        assert running == 0, f"Expected 0 running, got {running}"

    @pytest.mark.asyncio
    async def test_all_games_fail(self, db_session, seven_models):
        """If all games fail, they should all be marked FAILED."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 3)

        async def mock_execute(*args, **kwargs):
            raise RuntimeError("Everything is broken")

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game", side_effect=mock_execute),
            patch("app.services.game_runner.upload_game_logs"),
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()

        for game_id in game_ids:
            game = db_session.query(Game).filter(Game.id == game_id).first()
            assert game.status == GameStatus.FAILED, f"Game {game_id} is {game.status}"
            assert game.error_message is not None
            assert "RuntimeError" in game.error_message

    @pytest.mark.asyncio
    async def test_timeout_marks_game_failed(self, db_session, seven_models):
        """Games that exceed the timeout should be marked FAILED."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 1)

        async def mock_execute_slow(*args, **kwargs):
            await asyncio.sleep(999)  # Will be cancelled by timeout

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch(
                "app.services.game_runner.execute_amongagents_game", side_effect=mock_execute_slow
            ),
            patch("app.services.game_runner.upload_game_logs"),
            patch("app.services.game_runner.GAME_TIMEOUT_SECONDS", 0.1),  # 100ms timeout
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()
        game = db_session.query(Game).filter(Game.id == game_ids[0]).first()

        assert game.status == GameStatus.FAILED
        assert "timed out" in game.error_message.lower()

    @pytest.mark.asyncio
    async def test_upload_failure_marks_game_failed(self, db_session, seven_models):
        """If log upload fails after all retries, game should be marked FAILED."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 1)
        result = _make_game_result(seven_models)

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch(
                "app.services.game_runner.upload_game_logs",
                side_effect=RuntimeError("S3 is down"),
            ),
            # Eliminate retry delays so test is fast
            patch("time.sleep"),
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = result

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()
        game = db_session.query(Game).filter(Game.id == game_ids[0]).first()

        assert game.status == GameStatus.FAILED
        assert game.error_message is not None


class TestBulkRunnerConcurrency:
    """Tests for concurrency behavior: semaphore, DB locking, etc."""

    @pytest.mark.asyncio
    async def test_semaphore_limits_concurrency(self, db_session, seven_models):
        """The semaphore should limit how many games run concurrently."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 5)
        result = _make_game_result(seven_models)

        max_concurrent = 0
        current_concurrent = 0
        lock = asyncio.Lock()

        original_result = result

        async def mock_execute(*args, **kwargs):
            nonlocal max_concurrent, current_concurrent
            async with lock:
                current_concurrent += 1
                if current_concurrent > max_concurrent:
                    max_concurrent = current_concurrent
            await asyncio.sleep(0.05)  # Simulate some work
            async with lock:
                current_concurrent -= 1
            return original_result

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game", side_effect=mock_execute),
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=2, randomize_roles=False
            )

        # Should never exceed the rate limit of 2
        assert max_concurrent <= 2, f"Max concurrent was {max_concurrent}, expected <= 2"

        # All games should still complete
        db_session.expire_all()
        for game_id in game_ids:
            game = db_session.query(Game).filter(Game.id == game_id).first()
            assert game.status == GameStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_no_games_stuck_in_running(self, db_session, seven_models):
        """After run_multiple_games_async, zero games should be in RUNNING state."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 5)
        result = _make_game_result(seven_models)

        call_idx = 0

        async def mock_execute_mixed(*args, **kwargs):
            nonlocal call_idx
            call_idx += 1
            if call_idx % 3 == 0:
                raise RuntimeError("Intermittent failure")
            if call_idx % 5 == 0:
                await asyncio.sleep(999)  # Will be timed out
            return result

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch(
                "app.services.game_runner.execute_amongagents_game", side_effect=mock_execute_mixed
            ),
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
            patch("app.services.game_runner.GAME_TIMEOUT_SECONDS", 0.1),
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()

        running_games = db_session.query(Game).filter(Game.status == GameStatus.RUNNING).all()
        assert len(running_games) == 0, (
            f"Found {len(running_games)} games stuck in RUNNING: {[g.id for g in running_games]}"
        )

    @pytest.mark.asyncio
    async def test_db_session_not_held_during_execution(self, db_session, seven_models):
        """Verify that SessionLocal is called the expected number of times,
        and that it's not called during game execution itself."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 2)
        result = _make_game_result(seven_models)

        session_open_count = 0
        original_return = db_session

        def counting_session_factory():
            nonlocal session_open_count
            session_open_count += 1
            return original_return

        async def mock_execute(*args, **kwargs):
            # During game execution, no new sessions should be opened
            count_before = session_open_count
            await asyncio.sleep(0.01)
            count_after = session_open_count
            assert count_after == count_before, "SessionLocal was called during game execution!"
            return result

        with (
            patch("app.services.game_runner.SessionLocal", side_effect=counting_session_factory),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game", side_effect=mock_execute),
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        # Phase 1: 1 session for preparation
        # Phase 2/3: 1 session per game for saving results (under db_lock)
        # Total: 1 + 2 = 3
        assert session_open_count == 3, f"Expected 3 session opens, got {session_open_count}"


class TestBulkRunnerEdgeCases:
    """Tests for edge cases: empty game list, preparation failures, etc."""

    @pytest.mark.asyncio
    async def test_empty_game_list(self, db_session, seven_models):
        """Should handle an empty game list gracefully."""
        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")

            # Should not raise
            await run_multiple_games_async([], [], rate_limit=10)

        mock_execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_preparation_failure_skips_game(self, db_session, seven_models):
        """If a game can't be prepared (e.g., missing models), skip it but run others."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 2)

        # Give the second game invalid model IDs so preparation fails
        model_ids_list[1] = ["nonexistent-uuid"] * 7

        result = _make_game_result(seven_models)

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch("app.services.game_runner.upload_game_logs") as mock_upload,
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = result
            mock_upload.return_value = ("test-bucket", "test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()

        # First game should complete
        game_0 = db_session.query(Game).filter(Game.id == game_ids[0]).first()
        assert game_0.status == GameStatus.COMPLETED

        # Second game should be FAILED (preparation failure)
        game_1 = db_session.query(Game).filter(Game.id == game_ids[1]).first()
        assert game_1.status == GameStatus.FAILED
        assert "Expected 7 models" in game_1.error_message

        # execute_amongagents_game should only have been called once (for the valid game)
        assert mock_execute.call_count == 1

    @pytest.mark.asyncio
    async def test_cancelled_error_handled(self, db_session, seven_models):
        """CancelledError (BaseException) should still mark game as FAILED."""
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 1)

        async def mock_execute_cancelled(*args, **kwargs):
            raise asyncio.CancelledError()

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch(
                "app.services.game_runner.execute_amongagents_game",
                side_effect=mock_execute_cancelled,
            ),
            patch("app.services.game_runner.upload_game_logs"),
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()
        game = db_session.query(Game).filter(Game.id == game_ids[0]).first()

        assert game.status == GameStatus.FAILED
        assert game.error_message is not None


class TestBulkRunnerBlockingIOBugs:
    """Adversarial tests targeting the production freeze (502, zero logs).

    Root cause: _upload_logs_with_retry uses time.sleep() and synchronous
    boto3 calls inside the async event loop. When held under db_lock, this
    blocks the ENTIRE event loop — no other coroutines can make progress,
    which explains why the production backend freezes completely.

    These tests are designed to FAIL against the current code to prove
    the bugs exist, then PASS once fixed.
    """

    @pytest.mark.asyncio
    async def test_no_blocking_sleep_in_async_context(self, db_session, seven_models):
        """time.sleep() must NEVER be called while an asyncio event loop is running.

        _upload_logs_with_retry uses time.sleep() for retry delays, which
        freezes the entire event loop. This test detects that anti-pattern
        by spying on time.sleep and checking if it's called from async context.
        """
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 1)
        result = _make_game_result(seven_models)

        blocking_sleep_calls = []

        def spy_sleep(seconds):
            """Spy that records calls made while an event loop is running."""
            try:
                loop = asyncio.get_running_loop()
                if loop.is_running():
                    blocking_sleep_calls.append(seconds)
            except RuntimeError:
                pass
            # Don't actually sleep — keep the test fast

        upload_call_count = 0

        def failing_then_succeeding_upload(*args, **kwargs):
            nonlocal upload_call_count
            upload_call_count += 1
            if upload_call_count <= 1:
                raise RuntimeError("S3 temporarily unavailable")
            return ("test-bucket", "test-key")

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch(
                "app.services.game_runner.upload_game_logs",
                side_effect=failing_then_succeeding_upload,
            ),
            patch("time.sleep", side_effect=spy_sleep),
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = result

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        # The game should still complete (upload succeeded on retry)
        db_session.expire_all()
        game = db_session.query(Game).filter(Game.id == game_ids[0]).first()
        assert game.status == GameStatus.COMPLETED

        # THE BUG: time.sleep() was called from within the async event loop,
        # blocking ALL coroutines (including game execution, FastAPI handlers,
        # health checks, etc.)
        assert len(blocking_sleep_calls) == 0, (
            f"time.sleep() was called {len(blocking_sleep_calls)} time(s) from async "
            f"context with delays {blocking_sleep_calls}s. This blocks the entire event "
            f"loop! Use asyncio.sleep() or run_in_executor() instead."
        )

    @pytest.mark.asyncio
    async def test_event_loop_responsive_during_upload_retry(self, db_session, seven_models):
        """The event loop must remain responsive while uploads retry.

        A heartbeat task increments a counter every 1ms. If the event loop is
        blocked by time.sleep(), the counter stalls during the retry window.
        """
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 1)
        result = _make_game_result(seven_models)

        heartbeat_count = 0
        heartbeat_running = True

        async def heartbeat():
            nonlocal heartbeat_count
            while heartbeat_running:
                heartbeat_count += 1
                await asyncio.sleep(0.001)

        upload_call_count = 0
        heartbeat_at_retry_start = 0
        heartbeat_at_retry_end = 0

        def upload_with_one_failure(*args, **kwargs):
            nonlocal upload_call_count, heartbeat_at_retry_start, heartbeat_at_retry_end
            upload_call_count += 1
            if upload_call_count == 1:
                heartbeat_at_retry_start = heartbeat_count
                raise RuntimeError("S3 temporarily unavailable")
            # Second attempt: record heartbeat after the retry delay
            heartbeat_at_retry_end = heartbeat_count
            return ("test-bucket", "test-key")

        import time as time_module

        original_sleep = time_module.sleep

        def short_blocking_sleep(seconds):
            """Block for 50ms instead of 1s — still enough to prove the bug."""
            original_sleep(0.05)

        heartbeat_task = asyncio.create_task(heartbeat())

        try:
            with (
                patch("app.services.game_runner.SessionLocal", return_value=db_session),
                patch("app.services.game_runner.get_settings") as mock_settings,
                patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
                patch(
                    "app.services.game_runner.upload_game_logs",
                    side_effect=upload_with_one_failure,
                ),
                patch("time.sleep", side_effect=short_blocking_sleep),
            ):
                mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
                mock_execute.return_value = result

                await run_multiple_games_async(
                    game_ids, model_ids_list, rate_limit=10, randomize_roles=False
                )
        finally:
            heartbeat_running = False
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass

        # Between the failed upload and the retry, the heartbeat should have
        # incremented if the event loop was responsive. With 50ms of blocking,
        # the heartbeat (1ms interval) should have incremented ~50 times if the
        # loop was free, but 0 times if time.sleep blocked it.
        heartbeats_during_retry = heartbeat_at_retry_end - heartbeat_at_retry_start

        assert heartbeats_during_retry > 0, (
            f"Event loop was BLOCKED during upload retry! "
            f"Heartbeat before retry: {heartbeat_at_retry_start}, "
            f"after retry: {heartbeat_at_retry_end} (delta: {heartbeats_during_retry}). "
            f"time.sleep() froze the event loop for the entire retry delay."
        )

    @pytest.mark.asyncio
    async def test_slow_upload_does_not_block_concurrent_game_execution(
        self, db_session, seven_models
    ):
        """A slow upload should not prevent other games from executing.

        Since uploads now run in asyncio.to_thread(), the event loop stays
        responsive even during slow S3 uploads. This test verifies that
        game execution can overlap with uploads.
        """
        import time as time_module

        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 2)
        result = _make_game_result(seven_models)

        execute_call_count = 0

        async def staggered_execute(game_id, *args, **kwargs):
            nonlocal execute_call_count
            execute_call_count += 1
            idx = execute_call_count
            if idx == 2:
                # Game 2 takes 100ms — should be able to run during game 1's save
                await asyncio.sleep(0.1)
            return result

        def slow_upload(*args, **kwargs):
            """Simulate a slow S3 upload (runs in thread via asyncio.to_thread)."""
            time_module.sleep(0.1)  # 100ms — this is OK now because it's in a thread
            return ("test-bucket", "test-key")

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch(
                "app.services.game_runner.execute_amongagents_game",
                side_effect=staggered_execute,
            ),
            patch(
                "app.services.game_runner.upload_game_logs",
                side_effect=slow_upload,
            ),
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")

            start = time_module.monotonic()
            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )
            total_time = time_module.monotonic() - start

        # Both games should complete
        db_session.expire_all()
        for gid in game_ids:
            game = db_session.query(Game).filter(Game.id == gid).first()
            assert game.status == GameStatus.COMPLETED

        # With asyncio.to_thread, uploads don't block the event loop.
        # 2 uploads (0.1s each, serialized by db_lock) + game execution (overlapping)
        # should take ~0.2-0.3s. With blocking I/O, it would be 0.4s+.
        assert total_time < 0.5, (
            f"Total time {total_time:.3f}s suggests blocking I/O prevented concurrent "
            f"execution. Expected <0.5s with non-blocking I/O."
        )

    @pytest.mark.asyncio
    async def test_double_failure_does_not_leave_game_stuck_running(self, db_session, seven_models):
        """If _save_game_results AND _mark_game_failed both fail, game must
        not be left in RUNNING state forever.

        Current code path:
        1. _save_game_results raises (e.g. upload fails after 3 retries)
        2. db.rollback() reverts status to RUNNING (last committed state)
        3. _mark_game_failed raises (e.g. DB connection lost)
        4. Exception is logged but game is left in RUNNING — stuck forever!
        """
        game_ids, model_ids_list = _create_pending_games(db_session, seven_models, 1)
        result = _make_game_result(seven_models)

        mark_failed_call_count = 0

        def mark_failed_that_fails_on_second_call(db, game_id, error):
            """First call (from 'result is BaseException' branch) works fine.
            But in the save-failure path, _mark_game_failed is called after
            rollback — we make THIS call fail to simulate DB issues."""
            nonlocal mark_failed_call_count
            mark_failed_call_count += 1
            # The save-failure path calls _mark_game_failed after db.rollback()
            # Simulate that call also failing
            raise RuntimeError("DB connection lost during error recovery")

        with (
            patch("app.services.game_runner.SessionLocal", return_value=db_session),
            patch("app.services.game_runner.get_settings") as mock_settings,
            patch("app.services.game_runner.execute_amongagents_game") as mock_execute,
            patch(
                "app.services.game_runner.upload_game_logs",
                side_effect=RuntimeError("S3 completely down"),
            ),
            patch("time.sleep"),  # Skip retry delays
            patch(
                "app.services.game_runner._mark_game_failed",
                side_effect=mark_failed_that_fails_on_second_call,
            ),
        ):
            mock_settings.return_value = MagicMock(openrouter_api_key="test-key")
            mock_execute.return_value = result

            await run_multiple_games_async(
                game_ids, model_ids_list, rate_limit=10, randomize_roles=False
            )

        db_session.expire_all()
        game = db_session.query(Game).filter(Game.id == game_ids[0]).first()

        # THE BUG: game is stuck in RUNNING because:
        # 1. Phase 1 committed RUNNING
        # 2. _save_game_results set COMPLETED but upload failed → exception
        # 3. db.rollback() reverted to RUNNING
        # 4. _mark_game_failed also failed → game stays RUNNING forever
        assert game.status != GameStatus.RUNNING, (
            "Game stuck in RUNNING after both save and mark-as-failed failed! "
            "This game will never be cleaned up without manual intervention."
        )
