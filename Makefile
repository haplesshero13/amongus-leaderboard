# Makefile for Among Us LLM Leaderboard

.PHONY: help install dev dev-backend dev-frontend test lint seed clean docker-up docker-down

# Default target
help:
	@echo "Among Us LLM Leaderboard - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install          Install all dependencies"
	@echo "  make seed             Seed database with test models"
	@echo ""
	@echo "Development:"
	@echo "  make dev              Start all services for development"
	@echo "  make dev-backend      Start only backend (with MinIO)"
	@echo "  make dev-frontend     Start only frontend"
	@echo "  make docker-up        Start infrastructure services"
	@echo "  make docker-down      Stop infrastructure services"
	@echo ""
	@echo "Testing:"
	@echo "  make test             Run all tests"
	@echo "  make test-backend     Run backend tests"
	@echo "  make test-frontend    Run frontend tests"
	@echo "  make lint             Run linters"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean            Remove generated files"

# Install all dependencies
install:
	@echo "Installing backend dependencies..."
	cd backend && uv sync
	@echo "Installing frontend dependencies..."
	cd frontend && bun install
	@echo "Done!"

# Start infrastructure services (MinIO)
docker-up:
	docker-compose -f docker-compose.dev.yml up -d

docker-down:
	docker-compose -f docker-compose.dev.yml down

# Seed the database with test models
seed: docker-up
	@echo "Waiting for MinIO to be ready..."
	@sleep 2
	cd backend && uv run python -m scripts.seed_models

# Development - all services
dev: docker-up
	@echo "Starting development servers..."
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	@echo "MinIO Console: http://localhost:9001"
	@make -j2 dev-backend-only dev-frontend-only

dev-backend-only:
	cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend-only:
	cd frontend && bun run dev

# Start only backend (for backend-focused development)
dev-backend: docker-up
	cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start only frontend (uses mock data unless API_URL is set)
dev-frontend:
	cd frontend && bun run dev

# Run all tests
test: test-backend test-frontend

test-backend:
	cd backend && uv run pytest -v

test-frontend:
	cd frontend && bun run test

# Linting
lint:
	cd backend && uv run ruff check .
	cd frontend && bun run lint

# Type checking
type-check:
	cd backend && uv run mypy .
	cd frontend && bun run type-check

# Clean generated files
clean:
	rm -rf backend/*.db
	rm -rf backend/.pytest_cache
	rm -rf backend/**/__pycache__
	rm -rf frontend/.next
	rm -rf frontend/node_modules/.cache
	docker-compose -f docker-compose.dev.yml down -v
