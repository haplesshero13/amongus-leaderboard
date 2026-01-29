from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

from app.core.config import get_settings
from app.core.database import init_db
from app.api import leaderboard, games, models


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    init_db()
    yield
    # Shutdown
    pass


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Among Us LLM Leaderboard API",
        description="API for the Among Us LLM agent leaderboard",
        version="0.1.0",
        lifespan=lifespan,
        # Use ORJSON for faster, more compact JSON serialization
        default_response_class=ORJSONResponse,
    )

    # GZip compression for responses > 500 bytes
    app.add_middleware(GZipMiddleware, minimum_size=500)

    # Configure CORS for frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://lmdeceptionarena.averyyen.dev",
            "http://localhost:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(leaderboard.router, prefix=settings.api_prefix)
    app.include_router(games.router, prefix=settings.api_prefix)
    app.include_router(models.router, prefix=settings.api_prefix)

    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    return app


app = create_app()
