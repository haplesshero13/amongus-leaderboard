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

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    model_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("models.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )

    # TrueSkill parameters for impostor role
    impostor_mu: Mapped[float] = mapped_column(Float, nullable=False, default=25.0)
    impostor_sigma: Mapped[float] = mapped_column(Float, nullable=False, default=8.333)
    impostor_games: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # TrueSkill parameters for crewmate role
    crewmate_mu: Mapped[float] = mapped_column(Float, nullable=False, default=25.0)
    crewmate_sigma: Mapped[float] = mapped_column(Float, nullable=False, default=8.333)
    crewmate_games: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Cached previous rank for rank change calculation
    previous_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationship back to Model
    model: Mapped["Model"] = relationship("Model", back_populates="ratings")

    @property
    def total_games(self) -> int:
        """Total games played across both roles."""
        return (self.impostor_games or 0) + (self.crewmate_games or 0)

    @property
    def impostor_rating(self) -> float:
        """OpenSkill mu for impostor role."""
        return self.impostor_mu if self.impostor_mu is not None else 25.0

    @property
    def crewmate_rating(self) -> float:
        """OpenSkill mu for crewmate role."""
        return self.crewmate_mu if self.crewmate_mu is not None else 25.0

    @property
    def overall_rating(self) -> float:
        """
        Weighted average of impostor and crewmate mu values.
        Weights are based on games played in each role.
        Falls back to simple average if no games played.
        """
        total = self.total_games
        imp_mu = self.impostor_rating
        crew_mu = self.crewmate_rating

        if total == 0:
            # Default: average of both starting mu values
            return (imp_mu + crew_mu) / 2

        impostor_weight = (self.impostor_games or 0) / total
        crewmate_weight = (self.crewmate_games or 0) / total
        return (imp_mu * impostor_weight) + (crew_mu * crewmate_weight)

    def __repr__(self) -> str:
        return f"<ModelRating model_id={self.model_id} overall={self.overall_rating:.1f}>"


# Import for type hints (avoid circular imports)
from app.models.game import GameParticipant  # noqa: E402
