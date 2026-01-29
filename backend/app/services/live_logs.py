"""In-memory store for live game log streaming.

This module provides a simple pub/sub mechanism for streaming game logs
to connected SSE clients in real-time.
"""

import asyncio
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator


@dataclass
class GameStream:
    """State for a single game's live stream."""

    logs: list[dict[str, Any]] = field(default_factory=list)
    subscribers: list[asyncio.Queue[tuple[str, dict[str, Any]]]] = field(default_factory=list)
    summary: dict[str, Any] | None = None
    ended: bool = False


# Global store for active game streams
_streams: dict[str, GameStream] = {}


def start_game(game_id: str) -> None:
    """Initialize streaming for a game.

    Call this when a game starts running to prepare for log streaming.
    """
    _streams[game_id] = GameStream()


def push_log(game_id: str, log_entry: dict[str, Any]) -> None:
    """Push a log entry to all subscribers for a game.

    Args:
        game_id: The game ID to push logs for
        log_entry: The parsed log entry dict from agent-logs-compact.json
    """
    if game_id not in _streams:
        return

    stream = _streams[game_id]
    stream.logs.append(log_entry)

    # Notify all subscribers
    for queue in stream.subscribers:
        try:
            queue.put_nowait(("log", log_entry))
        except asyncio.QueueFull:
            # Drop event if queue is full (slow consumer)
            pass


async def subscribe(game_id: str) -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
    """Subscribe to live logs for a game.

    Yields existing buffered logs first, then streams new logs as they arrive.
    Yields ("end", summary_dict) when the game ends.

    Args:
        game_id: The game ID to subscribe to

    Yields:
        Tuples of (event_type, data) where event_type is "log" or "end"
    """
    if game_id not in _streams:
        return

    stream = _streams[game_id]
    queue: asyncio.Queue[tuple[str, dict[str, Any]]] = asyncio.Queue(maxsize=1000)

    # Send existing buffered logs first
    for log in stream.logs:
        yield ("log", log)

    # If game already ended, send end event and return
    if stream.ended:
        yield ("end", {"summary": stream.summary})
        return

    # Subscribe to new logs
    stream.subscribers.append(queue)
    try:
        while True:
            event_type, data = await queue.get()
            yield (event_type, data)
            if event_type == "end":
                break
    finally:
        # Clean up subscription
        if queue in stream.subscribers:
            stream.subscribers.remove(queue)


def end_game(game_id: str, summary: dict[str, Any] | None = None) -> None:
    """End streaming for a game.

    Notifies all subscribers that the game has ended and no more logs will come.

    Args:
        game_id: The game ID to end streaming for
        summary: Optional game summary to include in the end event
    """
    if game_id not in _streams:
        return

    stream = _streams[game_id]
    stream.ended = True
    stream.summary = summary

    # Notify all subscribers
    for queue in stream.subscribers:
        try:
            queue.put_nowait(("end", {"summary": summary}))
        except asyncio.QueueFull:
            pass


def cleanup_game(game_id: str) -> None:
    """Remove a game from the store to free memory.

    Call this some time after a game ends to clean up resources.
    """
    _streams.pop(game_id, None)


def is_streaming(game_id: str) -> bool:
    """Check if a game is currently available for streaming."""
    return game_id in _streams and not _streams[game_id].ended


def get_buffered_logs(game_id: str) -> list[dict[str, Any]]:
    """Get all buffered logs for a game (for debugging/testing)."""
    if game_id not in _streams:
        return []
    return list(_streams[game_id].logs)
