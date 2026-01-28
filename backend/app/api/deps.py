"""API dependencies for authentication and authorization."""

from fastapi import Header, HTTPException

from app.core.config import get_settings


def require_api_key(x_api_key: str = Header(..., alias="X-API-Key")) -> None:
    """
    Dependency that requires a valid API key in the X-API-Key header.

    The API key must match the OPENROUTER_API_KEY environment variable.
    This provides simple authentication: if you know the OpenRouter key,
    you can access protected endpoints (and spend credits).
    """
    settings = get_settings()
    if not settings.openrouter_api_key or x_api_key != settings.openrouter_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
