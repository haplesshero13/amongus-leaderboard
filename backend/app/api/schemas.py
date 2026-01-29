"""Pydantic schemas for API request/response validation."""

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


# === Leaderboard Schemas ===


class ModelRankingResponse(BaseModel):
    """Single model ranking in the leaderboard."""

    model_config = ConfigDict(from_attributes=True)

    model_id: str
    model_name: str
    provider: str
    overall_rating: float
    impostor_rating: float
    crewmate_rating: float
    games_played: int
    current_rank: int
    previous_rank: int
    rank_change: int
    release_date: str | None
    avatar_color: str


class LeaderboardResponse(BaseModel):
    """Paginated leaderboard response."""

    data: list[ModelRankingResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


# === Game Schemas ===


class GameStatusEnum(str, Enum):
    """Game status values."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TriggerGameRequest(BaseModel):
    """Request to trigger a new game."""

    model_ids: list[str] = Field(
        ...,
        min_length=7,
        max_length=7,
        description="Exactly 7 model IDs to participate in the game",
    )
    webhook_url: str | None = Field(
        None, description="Optional webhook URL to call on game completion"
    )


class TriggerGameResponse(BaseModel):
    """Response after triggering a game."""

    game_id: str
    status: GameStatusEnum


class GameParticipantResponse(BaseModel):
    """Participant in a game."""

    model_config = ConfigDict(from_attributes=True)

    model_id: str
    model_name: str
    player_number: int
    player_color: str
    role: str
    won: bool | None
    survived: bool | None


class GameResponse(BaseModel):
    """Full game details response."""

    model_config = ConfigDict(from_attributes=True)

    game_id: str
    status: GameStatusEnum
    started_at: datetime | None
    ended_at: datetime | None
    winner: int | None
    winner_reason: str | None
    participants: list[GameParticipantResponse]
    log_url: str | None = None
    error_message: str | None = None


# === Model Registry Schemas ===


class ModelCreateRequest(BaseModel):
    """Request to register a new model."""

    model_id: str = Field(..., description="Human-friendly model identifier")
    model_name: str = Field(..., description="Display name for the model")
    provider: str = Field(..., description="Provider/company name")
    openrouter_id: str = Field(..., description="OpenRouter model identifier for API calls")
    release_date: date | None = Field(None, description="Model release date")
    avatar_color: str = Field("#808080", description="Hex color for avatar")


class ModelUpdateRequest(BaseModel):
    """Request to update an existing model. All fields optional."""

    model_name: str | None = Field(None, description="Display name for the model")
    provider: str | None = Field(None, description="Provider/company name")
    openrouter_id: str | None = Field(None, description="OpenRouter model identifier for API calls")
    release_date: date | None = Field(None, description="Model release date")
    avatar_color: str | None = Field(None, description="Hex color for avatar")


class ModelResponse(BaseModel):
    """Model details response."""

    model_config = ConfigDict(from_attributes=True)

    model_id: str
    model_name: str
    provider: str
    openrouter_id: str
    release_date: date | None
    avatar_color: str


# === Game Log Schemas ===


class GameLogEntry(BaseModel):
    """Single log entry from a game (simplified for chat display)."""

    step: int
    timestamp: str
    player_name: str
    player_color: str
    player_role: str  # "Crewmate" or "Impostor"
    model: str
    location: str
    action: str  # The action taken (e.g., "MOVE from X to Y", "SPEAK: ...")
    thinking: str | None = None  # Optional thinking process
    memory: str | None = None  # Optional condensed memory


class GameLogsResponse(BaseModel):
    """Response containing game logs for chat display."""

    game_id: str
    entries: list[GameLogEntry]
    summary: dict | None = None
