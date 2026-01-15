from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


def get_engine():
    """Create database engine based on settings."""
    settings = get_settings()
    connect_args = {}

    # SQLite needs check_same_thread=False for FastAPI
    if settings.database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    return create_engine(settings.database_url, connect_args=connect_args)


engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
