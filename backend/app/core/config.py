from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore extra env vars not defined in Settings
    )

    # Database
    database_url: str = "sqlite:///./leaderboard.db"

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    # S3-compatible storage
    s3_endpoint_url: str | None = None  # None uses real AWS S3
    s3_bucket_name: str = "amongus-game-logs"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_region: str = "us-east-1"

    # Webhook configuration
    game_complete_webhook_url: str | None = None

    # AmongAgents configuration
    openrouter_api_key: str = ""

    # API settings
    api_prefix: str = "/api"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
