from datetime import datetime
import uuid

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column



def generate_uuid() -> str:
    """Generate a UUID string for use as primary key."""
    return str(uuid.uuid4())


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
