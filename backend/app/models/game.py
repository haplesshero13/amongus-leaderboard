"""Game and game participant models."""

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid


class GameStatus(str, Enum):
    """Status of a game."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class GameWinner(int, Enum):
    """
    Winner codes from AmongAgents.

    1 = Impostors win (crewmates outnumbered)
    2 = Crewmates win (all impostors eliminated)
    3 = Crewmates win (all tasks completed)
    4 = Impostors win (time limit reached)
    """

    IMPOSTORS_OUTNUMBER = 1
    CREWMATES_ELIMINATED_IMPOSTORS = 2
    CREWMATES_TASKS_COMPLETED = 3
    IMPOSTORS_TIME_LIMIT = 4


class PlayerRole(str, Enum):
    """Role a player had in a game."""

    IMPOSTOR = "Impostor"
    CREWMATE = "Crewmate"


class Game(Base, TimestampMixin):
    """
    Record of a single Among Us game.

    Stores metadata about the game and reference to the full logs in S3.
    """

    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    status: Mapped[GameStatus] = mapped_column(
        SQLEnum(GameStatus), nullable=False, default=GameStatus.PENDING
    )

    # Game timing
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Game result
    winner: Mapped[int | None] = mapped_column(Integer, nullable=True)
    winner_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # S3 storage reference for full game logs
    log_bucket: Mapped[str | None] = mapped_column(String(100), nullable=True)
    log_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Error information if game failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Webhook URL to call on completion (optional)
    webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Model IDs participating in this game (stored before game runs, participants created after)
    model_ids: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # Relationships
    participants: Mapped[list["GameParticipant"]] = relationship(
        "GameParticipant", back_populates="game", cascade="all, delete-orphan"
    )

    @property
    def impostors_won(self) -> bool:
        """Check if impostors won this game."""
        return self.winner in (GameWinner.IMPOSTORS_OUTNUMBER.value, GameWinner.IMPOSTORS_TIME_LIMIT.value)

    @property
    def crewmates_won(self) -> bool:
        """Check if crewmates won this game."""
        return self.winner in (
            GameWinner.CREWMATES_ELIMINATED_IMPOSTORS.value,
            GameWinner.CREWMATES_TASKS_COMPLETED.value,
        )

    def __repr__(self) -> str:
        return f"<Game {self.id[:8]} status={self.status.value}>"


class GameParticipant(Base):
    """
    Junction table linking games to models.

    Records which model played in which game, their role, and outcome.
    """

    __tablename__ = "game_participants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    game_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("models.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Player assignment in the game
    player_number: Mapped[int] = mapped_column(Integer, nullable=False)
    player_color: Mapped[str] = mapped_column(String(20), nullable=False)
    role: Mapped[PlayerRole] = mapped_column(SQLEnum(PlayerRole), nullable=False)

    # Outcome
    won: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    survived: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Relationships
    game: Mapped["Game"] = relationship("Game", back_populates="participants")
    model: Mapped["Model"] = relationship("Model", back_populates="game_participations")

    def __repr__(self) -> str:
        return f"<GameParticipant game={self.game_id[:8]} model={self.model_id[:8]} role={self.role.value}>"


# Import for type hints (avoid circular imports)
from app.models.model import Model  # noqa: E402
