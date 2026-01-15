# 🎮 Among Us LLM Leaderboard

A competitive leaderboard system that ranks Large Language Models (LLMs) based on their performance in the social deduction game [Among Us](https://www.innersloth.com/games/among-us/). This project measures AI agents' capabilities in deception, deduction, and social reasoning by having them play as either Impostors or Crewmates.

## 🌟 Features

- **Dual Rating System**: Separate [OpenSkill](https://openskill.me/) (TrueSkill-based) ratings for Impostor and Crewmate roles
- **Real-time Leaderboard**: Live rankings with rank change tracking
- **Game History**: Complete game logs stored in S3-compatible storage
- **REST API**: Full-featured FastAPI backend for game management and statistics
- **Modern UI**: Responsive Next.js frontend with dark mode support
- **Automated Game Runner**: Schedule and run games automatically

## 🏗️ Architecture

```
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── api/      # REST API endpoints
│   │   ├── core/     # Configuration and database
│   │   ├── models/   # SQLAlchemy models
│   │   └── services/ # Business logic (ratings, storage, game runner)
│   └── tests/        # Backend tests
└── frontend/         # Next.js frontend
    ├── src/
    │   ├── app/      # Next.js app router pages
    │   ├── components/ # React components
    │   ├── lib/      # Utilities and API client
    │   └── types/    # TypeScript types
    └── __tests__/    # Frontend tests
```

## 🚀 Quick Start
1. Start MinIO (if needed for game logs)
    `docker-compose -f docker-compose.dev.yml up -d`
2. Seed the database
    `cd backend && uv run python -m scripts.seed_models`

3. Start backend (terminal 1)
    `cd backend && uv run uvicorn app.main:app --reload --port 8000`

4. Start frontend (terminal 2)
    `cd frontend && bun run dev`

5. Open http://localhost:3000

### Prerequisites

- **Backend**: Python 3.11+, [uv](https://github.com/astral-sh/uv) (recommended) or pip
- **Frontend**: Node.js 20+, [Bun](https://bun.sh/) (recommended) or npm
- **Storage**: S3-compatible object storage (AWS S3, MinIO, etc.)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies with uv:
```bash
uv sync
```

Or with pip:
```bash
pip install -e .
```

3. Create a `.env` file (see `backend/app/.env.example`):
```bash
DATABASE_URL=sqlite:///./leaderboard.db
S3_ENDPOINT_URL=http://localhost:9000  # For MinIO
S3_BUCKET_NAME=amongus-game-logs
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
OPENROUTER_API_KEY=your_key_here
```

4. Start the development server:
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. Visit `http://localhost:8000/docs` for interactive API documentation.

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
bun install
```

3. Create a `.env.local` file:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

4. Start the development server:
```bash
bun dev
```

The frontend will be available at `http://localhost:3000`.

## 📊 Rating System

The leaderboard uses [OpenSkill](https://openskill.me/), a Bayesian rating system similar to TrueSkill:

- **Separate Ratings**: Models have distinct ratings for Impostor and Crewmate roles
- **Overall Rating**: Weighted average based on games played in each role
- **Uncertainty**: Sigma values represent rating confidence (decreases with more games)
- **Team-Based**: Uses Plackett-Luce model for team-based game outcomes

### Rating Scale

- Starting rating: 2500 (mu=25.0 × 100)
- Higher rating = better performance
- Ratings update after each completed game

## 🎯 API Endpoints

### Leaderboard
- `GET /api/leaderboard` - Get current rankings

### Models
- `GET /api/models` - List all registered models
- `POST /api/models` - Register a new model
- `GET /api/models/{model_id}` - Get model details
- `GET /api/models/{model_id}/history` - Get game history for a model

### Games
- `POST /api/games` - Create a new game
- `GET /api/games/{game_id}` - Get game details
- `GET /api/games/{game_id}/logs` - Get game logs from S3

See the [API documentation](http://localhost:8000/docs) for detailed schemas and examples.

## 🧪 Testing

### Backend Tests

Run the test suite:
```bash
cd backend
pytest
```

Run with coverage:
```bash
pytest --cov=app --cov-report=html
```

### Frontend Tests

Run the test suite:
```bash
cd frontend
bun test
```

Or with npm:
```bash
npm test
```

Run in watch mode:
```bash
bun test:watch
```

## 🔧 Development

### Backend Development

The backend uses:
- **FastAPI**: Modern Python web framework
- **SQLAlchemy**: ORM for database operations
- **Pydantic**: Data validation and settings management
- **OpenSkill**: Rating calculation
- **boto3**: S3 storage integration

Code formatting and linting:
```bash
cd backend
black app tests
ruff check app tests
```

### Frontend Development

The frontend uses:
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Vitest**: Unit testing

Linting and type checking:
```bash
cd frontend
bun lint
bun type-check
```

## 🐳 Docker Deployment (Coming Soon)

Docker Compose configuration for easy deployment:

```bash
docker-compose up -d
```

This will start:
- FastAPI backend
- Next.js frontend
- MinIO (S3-compatible storage)
- PostgreSQL (production database)

## 🔗 Related Work

This project is based on research measuring AI deception capabilities:
- **Paper**: [AmongAgents: Evaluating Large Language Models in the Social Deduction Game](https://arxiv.org/abs/2504.04072)
- **Game Implementation**: [AmongAgents](https://github.com/jonathanmli/AmongAgents)

