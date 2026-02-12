import pytest
from unittest.mock import AsyncMock, call, patch

from scripts.run_games import run_direct_games


@pytest.mark.asyncio
async def test_run_direct_games_invokes_runner():
    with patch(
        "scripts.run_games.create_game_with_matchmaking",
        side_effect=[("game-1", ["m1"]), ("game-2", ["m2"])],
    ) as create_game, patch(
        "app.services.game_runner.run_game_async",
        new_callable=AsyncMock,
    ) as run_game:
        triggered = await run_direct_games(num_games=2, delay=0)

    assert triggered == ["game-1", "game-2"]
    assert create_game.call_count == 2
    run_game.assert_has_awaits(
        [
            call("game-1", ["m1"], randomize_roles=False, stream_logs=False),
            call("game-2", ["m2"], randomize_roles=False, stream_logs=False),
        ]
    )


@pytest.mark.asyncio
async def test_run_direct_games_handles_setup_error():
    with patch(
        "scripts.run_games.create_game_with_matchmaking",
        side_effect=RuntimeError("boom"),
    ) as create_game, patch(
        "app.services.game_runner.run_game_async",
        new_callable=AsyncMock,
    ) as run_game:
        triggered = await run_direct_games(num_games=1, delay=0)

    assert triggered == []
    assert create_game.call_count == 1
    run_game.assert_not_awaited()


@pytest.mark.asyncio
async def test_run_direct_games_handles_run_error():
    with patch(
        "scripts.run_games.create_game_with_matchmaking",
        return_value=("game-1", ["m1"]),
    ) as create_game, patch(
        "app.services.game_runner.run_game_async",
        new_callable=AsyncMock,
    ) as run_game:
        run_game.side_effect = RuntimeError("boom")
        triggered = await run_direct_games(num_games=1, delay=0)

    assert triggered == []
    assert create_game.call_count == 1
    run_game.assert_awaited_once()
