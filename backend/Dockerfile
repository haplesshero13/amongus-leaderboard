FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PostgreSQL and git (for pip git dependencies)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast package management
RUN pip install uv

# Copy dependency files
COPY pyproject.toml .

# Add a build argument that changes on every deployment to bust the cache
# This ensures we pull the latest version of git dependencies (amongagents)
ARG RAILWAY_DEPLOYMENT_ID

# Install dependencies including psycopg2
RUN uv pip install --system -e . psycopg2-binary

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application (production mode, no --reload)
# Railway sets PORT dynamically, default to 8000 for local dev
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
