from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "sqlite:///./leaderboard.db"

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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
