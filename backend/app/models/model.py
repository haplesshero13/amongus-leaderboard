"""AI Model registry and rating models."""

from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid


class Model(Base, TimestampMixin):
    """
    Registry of AI models that can participate in games.

    The model_id is a human-friendly identifier (e.g., "claude-opus-4").
    This is separate from the OpenRouter model string used for API calls.
    """

    __tablename__ = "models"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    model_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(200), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    openrouter_id: Mapped[str] = mapped_column(String(200), nullable=False)
    release_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    avatar_color: Mapped[str] = mapped_column(String(7), nullable=False, default="#808080")

    # Relationships
    ratings: Mapped["ModelRating"] = relationship(
        "ModelRating", back_populates="model", uselist=False, cascade="all, delete-orphan"
    )
    game_participations: Mapped[list["GameParticipant"]] = relationship(
        "GameParticipant", back_populates="model"
    )

    def __repr__(self) -> str:
        return f"<Model {self.model_id}: {self.model_name}>"


class ModelRating(Base, TimestampMixin):
    """
    TrueSkill ratings for a model.

    Stores separate ratings for impostor and crewmate roles.
    Overall rating is computed as a weighted average based on games played in each role.
    """

    __tablename__ = "model_ratings"

    # OpenSkill default values
    DEFAULT_MU = 25.0
    DEFAULT_SIGMA = 8.333

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    model_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("models.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # TrueSkill parameters for impostor role
    impostor_mu: Mapped[float] = mapped_column(Float, nullable=False, default=DEFAULT_MU)
    impostor_sigma: Mapped[float] = mapped_column(Float, nullable=False, default=DEFAULT_SIGMA)
    impostor_games: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    impostor_wins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # TrueSkill parameters for crewmate role
    crewmate_mu: Mapped[float] = mapped_column(Float, nullable=False, default=DEFAULT_MU)
    crewmate_sigma: Mapped[float] = mapped_column(Float, nullable=False, default=DEFAULT_SIGMA)
    crewmate_games: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    crewmate_wins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationship back to Model
    model: Mapped["Model"] = relationship("Model", back_populates="ratings")

    @property
    def total_games(self) -> int:
        """Total games played across both roles."""
        return (self.impostor_games or 0) + (self.crewmate_games or 0)

    @property
    def total_wins(self) -> int:
        """Total wins across both roles."""
        return (self.impostor_wins or 0) + (self.crewmate_wins or 0)

    @property
    def impostor_win_rate(self) -> float:
        """Win rate as impostor (0.0 to 1.0)."""
        if not self.impostor_games:
            return 0.0
        return (self.impostor_wins or 0) / self.impostor_games

    @property
    def crewmate_win_rate(self) -> float:
        """Win rate as crewmate (0.0 to 1.0)."""
        if not self.crewmate_games:
            return 0.0
        return (self.crewmate_wins or 0) / self.crewmate_games

    @property
    def overall_win_rate(self) -> float:
        """Overall win rate across both roles (0.0 to 1.0)."""
        total = self.total_games
        if total == 0:
            return 0.0
        return self.total_wins / total

    @property
    def impostor_rating(self) -> float:
        """OpenSkill mu for impostor role."""
        return self.impostor_mu if self.impostor_mu is not None else self.DEFAULT_MU

    @property
    def crewmate_rating(self) -> float:
        """OpenSkill mu for crewmate role."""
        return self.crewmate_mu if self.crewmate_mu is not None else self.DEFAULT_MU

    @property
    def overall_rating(self) -> float:
        """
        Weighted average of impostor and crewmate mu values.

        Weights are based on games played, but unplayed roles count as 1 game
        at the default rating. This ensures players can't game the system by
        only playing one role - their unproven role still affects their overall.
        """
        # Use at least 1 game weight for each role (prior at default rating)
        imp_weight = max(1, self.impostor_games or 0)
        crew_weight = max(1, self.crewmate_games or 0)
        total = imp_weight + crew_weight

        return (
            self.impostor_rating * imp_weight + self.crewmate_rating * crew_weight
        ) / total

    def reset_to_defaults(self) -> None:
        """Reset all rating values to OpenSkill defaults."""
        self.impostor_mu = self.DEFAULT_MU
        self.impostor_sigma = self.DEFAULT_SIGMA
        self.impostor_games = 0
        self.impostor_wins = 0
        self.crewmate_mu = self.DEFAULT_MU
        self.crewmate_sigma = self.DEFAULT_SIGMA
        self.crewmate_games = 0
        self.crewmate_wins = 0

    def __repr__(self) -> str:
        return f"<ModelRating model_id={self.model_id} overall={self.overall_rating:.1f}>"


# Import for type hints (avoid circular imports)
from app.models.game import GameParticipant  # noqa: E402
