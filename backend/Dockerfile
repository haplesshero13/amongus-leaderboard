FROM python:3.11-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install system dependencies for PostgreSQL and git
RUN apt-get update && apt-get install -y \
  libpq-dev \
  gcc \
  git \
  && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies using uv sync
# --frozen ensures we use the exact versions from uv.lock
# --no-dev excludes development dependencies
# --no-install-project skips installing the project itself in this layer for better caching
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY . .

# Install the project itself
RUN uv sync --frozen --no-dev

# Expose port
EXPOSE 8000

# Set environment variables to use the virtual environment created by uv
ENV PATH="/app/.venv/bin:$PATH"

# Run the application (production mode)
# Railway sets PORT dynamically, default to 8000 for local dev
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
