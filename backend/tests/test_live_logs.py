"""Tests for the live log streaming service."""

import asyncio

import pytest

from app.services import live_logs


@pytest.fixture(autouse=True)
def clean_streams():
    """Clean up the global streams before and after each test."""
    live_logs._streams.clear()
    yield
    live_logs._streams.clear()


class TestStartGame:
    """Tests for start_game function."""

    def test_creates_stream_for_game(self):
        """Should create a new stream entry for the game."""
        live_logs.start_game("game-123")

        assert "game-123" in live_logs._streams
        stream = live_logs._streams["game-123"]
        assert stream.logs == []
        assert stream.subscribers == []
        assert stream.summary is None
        assert stream.ended is False

    def test_overwrites_existing_stream(self):
        """Should overwrite if game already exists."""
        live_logs.start_game("game-123")
        live_logs._streams["game-123"].logs.append({"test": "data"})

        live_logs.start_game("game-123")

        assert live_logs._streams["game-123"].logs == []


class TestPushLog:
    """Tests for push_log function."""

    def test_adds_log_to_buffer(self):
        """Should add log entry to the stream's buffer."""
        live_logs.start_game("game-123")
        entry = {"step": 1, "player": "test"}

        live_logs.push_log("game-123", entry)

        assert len(live_logs._streams["game-123"].logs) == 1
        assert live_logs._streams["game-123"].logs[0] == entry

    def test_does_nothing_for_unknown_game(self):
        """Should silently ignore logs for unknown games."""
        live_logs.push_log("unknown-game", {"step": 1})

        assert "unknown-game" not in live_logs._streams

    def test_notifies_subscribers(self):
        """Should push log to all subscriber queues."""
        live_logs.start_game("game-123")
        queue: asyncio.Queue = asyncio.Queue()
        live_logs._streams["game-123"].subscribers.append(queue)

        entry = {"step": 1, "data": "test"}
        live_logs.push_log("game-123", entry)

        assert not queue.empty()
        event_type, data = queue.get_nowait()
        assert event_type == "log"
        assert data == entry


class TestEndGame:
    """Tests for end_game function."""

    def test_marks_stream_as_ended(self):
        """Should mark the stream as ended."""
        live_logs.start_game("game-123")

        live_logs.end_game("game-123")

        assert live_logs._streams["game-123"].ended is True

    def test_stores_summary(self):
        """Should store the summary in the stream."""
        live_logs.start_game("game-123")
        summary = {"winner": 1, "players": ["a", "b"]}

        live_logs.end_game("game-123", summary)

        assert live_logs._streams["game-123"].summary == summary

    def test_notifies_subscribers_with_end_event(self):
        """Should send end event to all subscribers."""
        live_logs.start_game("game-123")
        queue: asyncio.Queue = asyncio.Queue()
        live_logs._streams["game-123"].subscribers.append(queue)

        summary = {"winner": 2}
        live_logs.end_game("game-123", summary)

        event_type, data = queue.get_nowait()
        assert event_type == "end"
        assert data == {"summary": summary}

    def test_does_nothing_for_unknown_game(self):
        """Should silently ignore unknown games."""
        live_logs.end_game("unknown-game", {"summary": "test"})

        assert "unknown-game" not in live_logs._streams


class TestSubscribe:
    """Tests for subscribe async generator."""

    @pytest.mark.asyncio
    async def test_yields_buffered_logs_first(self):
        """Should yield all buffered logs before waiting for new ones."""
        live_logs.start_game("game-123")
        live_logs.push_log("game-123", {"step": 1})
        live_logs.push_log("game-123", {"step": 2})
        live_logs.end_game("game-123")  # End so we don't wait forever

        events = []
        async for event in live_logs.subscribe("game-123"):
            events.append(event)

        assert len(events) == 3  # 2 logs + 1 end
        assert events[0] == ("log", {"step": 1})
        assert events[1] == ("log", {"step": 2})
        assert events[2][0] == "end"

    @pytest.mark.asyncio
    async def test_returns_immediately_for_unknown_game(self):
        """Should return empty generator for unknown games."""
        events = []
        async for event in live_logs.subscribe("unknown-game"):
            events.append(event)

        assert events == []

    @pytest.mark.asyncio
    async def test_yields_end_event_if_already_ended(self):
        """Should yield end event immediately if game already ended."""
        live_logs.start_game("game-123")
        summary = {"winner": 1}
        live_logs.end_game("game-123", summary)

        events = []
        async for event in live_logs.subscribe("game-123"):
            events.append(event)

        assert events == [("end", {"summary": summary})]

    @pytest.mark.asyncio
    async def test_receives_new_logs_after_subscribing(self):
        """Should receive logs pushed after subscribing."""
        live_logs.start_game("game-123")

        received_events = []

        async def subscriber():
            async for event in live_logs.subscribe("game-123"):
                received_events.append(event)
                if event[0] == "end":
                    break

        # Start subscriber in background
        task = asyncio.create_task(subscriber())

        # Give subscriber time to register
        await asyncio.sleep(0.01)

        # Push logs and end
        live_logs.push_log("game-123", {"step": 1})
        live_logs.push_log("game-123", {"step": 2})
        live_logs.end_game("game-123")

        # Wait for subscriber to finish
        await asyncio.wait_for(task, timeout=1.0)

        assert len(received_events) == 3
        assert received_events[0] == ("log", {"step": 1})
        assert received_events[1] == ("log", {"step": 2})
        assert received_events[2][0] == "end"

    @pytest.mark.asyncio
    async def test_cleanup_on_disconnect(self):
        """Should remove subscriber from list on disconnect."""
        live_logs.start_game("game-123")

        async def subscriber():
            async for event in live_logs.subscribe("game-123"):
                break  # Disconnect immediately after first event

        # Push a log so subscriber has something to receive
        live_logs.push_log("game-123", {"step": 1})

        await subscriber()

        # Subscriber should be removed
        assert len(live_logs._streams["game-123"].subscribers) == 0


class TestCleanupGame:
    """Tests for cleanup_game function."""

    def test_removes_game_from_store(self):
        """Should remove the game from the global store."""
        live_logs.start_game("game-123")

        live_logs.cleanup_game("game-123")

        assert "game-123" not in live_logs._streams

    def test_does_nothing_for_unknown_game(self):
        """Should not raise for unknown games."""
        live_logs.cleanup_game("unknown-game")  # Should not raise


class TestIsStreaming:
    """Tests for is_streaming function."""

    def test_returns_true_for_active_stream(self):
        """Should return True for an active streaming game."""
        live_logs.start_game("game-123")

        assert live_logs.is_streaming("game-123") is True

    def test_returns_false_for_ended_stream(self):
        """Should return False for an ended game."""
        live_logs.start_game("game-123")
        live_logs.end_game("game-123")

        assert live_logs.is_streaming("game-123") is False

    def test_returns_false_for_unknown_game(self):
        """Should return False for unknown games."""
        assert live_logs.is_streaming("unknown-game") is False


class TestGetBufferedLogs:
    """Tests for get_buffered_logs function."""

    def test_returns_copy_of_logs(self):
        """Should return a copy of buffered logs."""
        live_logs.start_game("game-123")
        live_logs.push_log("game-123", {"step": 1})
        live_logs.push_log("game-123", {"step": 2})

        logs = live_logs.get_buffered_logs("game-123")

        assert logs == [{"step": 1}, {"step": 2}]
        # Verify it's a copy
        logs.append({"step": 3})
        assert len(live_logs._streams["game-123"].logs) == 2

    def test_returns_empty_for_unknown_game(self):
        """Should return empty list for unknown games."""
        assert live_logs.get_buffered_logs("unknown-game") == []
