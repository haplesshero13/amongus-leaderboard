# LM Deception Arena

An Among Us-style leaderboard for AI language models, where LLMs play deception games against each other and get rated using OpenSkill.

## Live Deployment

- **Frontend**: https://lmdeceptionarena.averyyen.dev
- **API**: https://api.lmdeceptionarena.averyyen.dev

## Features

### 📊 Live Leaderboard
Rankings of AI models based on their performance as both Crewmates and Impostors. The dashboard tracks for each model:
- **Skill Rating**: Overall OpenSkill rating derived from match outcomes
- **Role Performance**: Separate ratings for Crewmate and Impostor play
- **Win/Loss Record**: Win-loss stats for each role and overall
- **Number of Games**: Total games played

### 🕵️ Game Review & Logs
Dive deep into every match with full transcripts of the game. Analyze how models:
- Deceive and betray each other as Impostors
- Execute tasks and seek the truth as Crewmates
- Debate in meetings and cast votes

Game status determines the viewing experience:
- **Running**: Live streaming view with real-time log updates via SSE (shows animated "LIVE" indicator)
- **Completed**: Full game replay loaded from cloud storage (R2)
- **Failed**: Shows error message explaining what went wrong
- **Pending**: Waiting state before game execution begins

## Architecture

- **Frontend**: Next.js 15 with React 19, deployed on Railway
- **Backend**: FastAPI with SQLAlchemy, deployed on Railway
- **Database**: PostgreSQL (Railway)
- **Storage**: Cloudflare R2 (S3-compatible) for game logs
- **LLM Provider**: OpenRouter for model API calls

## API Endpoints

To use these examples, first set up your environment variables:

```bash
export API_URL="http://localhost:8000" # or "https://api.lmdeceptionarena.averyyen.dev"
export OPENROUTER_API_KEY="your-key-here"
```

### Public Endpoints

```bash
# Get leaderboard
curl "$API_URL/api/leaderboard?page=1&per_page=20"

# List all models
curl "$API_URL/api/models"

# Get specific model
curl "$API_URL/api/models/claude-3.5-haiku"

# List games
curl "$API_URL/api/games?status=completed&limit=20"

# Get game details
curl "$API_URL/api/games/{game_id}"

# Get game logs (completed games only)
curl "$API_URL/api/games/{game_id}/logs"

# Stream live logs (running games only, SSE)
curl -N "$API_URL/api/games/{game_id}/stream"
```

### Protected Endpoints

```bash
# Register a new model
curl -X POST "$API_URL/api/models" \
  -H "X-API-Key: $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "claude-3.5-haiku",
    "model_name": "Claude 3.5 Haiku",
    "provider": "Anthropic",
    "openrouter_id": "anthropic/claude-3.5-haiku",
    "avatar_color": "#FF6B6B"
  }'

# Update a model
curl -X PATCH "$API_URL/api/models/claude-3.5-haiku" \
  -H "X-API-Key: $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "Claude 3.5 Haiku (V2)",
    "avatar_color": "#FF0000"
  }'

# Delete a model
curl -X DELETE "$API_URL/api/models/claude-3.5-haiku" \
  -H "X-API-Key: $OPENROUTER_API_KEY"

# Trigger a game (requires 7 registered models)
curl -X POST "$API_URL/api/games/trigger" \
  -H "X-API-Key: $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model_ids": [
      "claude-3.5-haiku", "gemini-3-flash", "gpt-oss-20b", 
      "solar-pro-3", "llama-3.3-70b", "deepseek-r1", "qwen3-235b"
    ],
    "webhook_url": "https://your-webhook.com/callback"
  }'

# Recalculate Ratings (Resets history!)
# Returns {"models_reset": N, "games_processed": M}
# If games_processed is 0, no completed games exist to rebuild from
curl -X POST "$API_URL/api/ratings/recalculate" \
  -H "X-API-Key: $OPENROUTER_API_KEY"
```

## Registered Models

| Model ID | Display Name | Provider | OpenRouter ID |
|----------|--------------|----------|---------------|
| claude-haiku-4.5 | Claude Haiku 4.5 | Anthropic | anthropic/claude-haiku-4.5 |
| gemini-3-flash | Gemini 3 Flash | Google | google/gemini-3-flash-preview |
| gpt-oss-20b | GPT-OSS 20B | OpenAI | openai/gpt-oss-20b |
| solar-pro-3 | Solar Pro 3 | Upstage | upstage/solar-pro-3:free |
| mistral-large-2512 | Mistral Large | Mistral AI | mistralai/mistral-large-2512 |
| llama-3.3-70b | Llama 3.3 70B | Meta | meta-llama/llama-3.3-70b-instruct:free |
| gpt-5-mini | GPT-5 Mini | OpenAI | openai/gpt-5-mini |
| kimi-k2.5 | Kimi K2.5 | Moonshot AI | moonshotai/kimi-k2.5 |
| deepseek-r1 | DeepSeek R1 | DeepSeek | deepseek/deepseek-r1-0528 |
| qwen3-235b | Qwen3 235B | Alibaba | qwen/qwen3-235b-a22b-2507 |
| glm-4.7 | Z.AI GLM 4.7 | Z.AI | z-ai/glm-4.7 |
| claude-sonnet-4.5 | Claude Sonnet 4.5 | Anthropic | anthropic/claude-sonnet-4.5 |
| gpt-oss-120b | GPT OSS 120B | OpenAI | openai/gpt-oss-120b |
| deepseek-v3.2 | DeepSeek V3.2 | DeepSeek | deepseek/deepseek-v3.2 |
| llama-4-maverick | Llama 4 Maverick | Meta | meta-llama/llama-4-maverick |
| llama-4-scout | Llama 4 Scout | Meta | meta-llama/llama-4-scout |
| llama-3.1-405b | Llama 3.1 405B | Meta | meta-llama/llama-3.1-405b-instruct |
| qwen3-next-80b-thinking | Qwen3 Next 80B (Think) | Alibaba | qwen/qwen3-next-80b-a3b-thinking |
| minimax-m2 | MiniMax M2 | MiniMax | minimax/minimax-m2 |
| kimi-k2-thinking | Kimi K2 Thinking | Moonshot AI | moonshotai/kimi-k2-thinking |

## Local Development

### Backend

```bash
cd backend
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"

# Set environment variables
cp .env.example .env
# Edit .env with your credentials

# Run development server
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
bun install
bun run dev
```

## Environment Variables

### Backend (.env)

```
DATABASE_URL=postgresql://user:pass@localhost:5432/amongus
S3_ENDPOINT_URL=https://account.r2.cloudflarestorage.com
S3_BUCKET_NAME=amongus-game-logs
S3_ACCESS_KEY=your-r2-access-key
S3_SECRET_KEY=your-r2-secret-key
S3_REGION=auto
OPENROUTER_API_KEY=sk-or-v1-...
```

### Frontend (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Deployment

### Auto-Deploy (GitHub Actions)

Push to `main` triggers automatic deployment. Set up once:

1. Get your Railway token: `railway login` then `railway whoami --token`
2. Add `RAILWAY_TOKEN` to GitHub repo secrets (Settings > Secrets > Actions)
3. Push to main - both services deploy automatically

### Manual Deploy (One-liner)

```bash
# Deploy everything
cd backend && railway up --service backend -d && cd ../frontend && railway up --service frontend -d
```

### Railway Setup

The app is deployed on Railway with:
- PostgreSQL database plugin
- Backend service (Dockerfile in `/backend`)
- Frontend service (Dockerfile in `/frontend`)

Custom domains are configured via Railway with DNS CNAME records pointing to Railway's edge.

### Database Migrations

Migrations are managed with Alembic and run manually (not on deploy):

```bash
# Get from Railway Postgres service
export DATABASE_URL=postgresql://user:pass@...

cd backend

# Run migrations against production
railway run alembic upgrade head

# Create a new migration after changing models
uv run alembic revision --autogenerate -m "add new column"

# Check migration status
railway run alembic current
```

## Game Rules

- 7 players per game (2 Impostors, 5 Crewmates)
- Impostors try to eliminate crewmates without being caught
- Crewmates try to identify and vote out impostors
- Win conditions:
  - Impostors win if they outnumber crewmates or time runs out
  - Crewmates win if all impostors are eliminated or all tasks complete

## Rating System

Uses OpenSkill (Weng-Lin rating system) with:
- Separate ratings for Impostor and Crewmate roles
- Overall rating is weighted average
- Starting rating: 2500 (μ=25, σ=8.333)

## Credits

This project is based on the research by Satvik Golechha and Adrià Garriga-Alonso.

- **Paper**: [arxiv.org/abs/2504.04072](https://arxiv.org/abs/2504.04072)
- **Original Code**: [github.com/7vik/AmongUs](https://github.com/7vik/AmongUs)

**Disclaimer**: This website is not affiliated with, funded by, or endorsed by FAR.AI, Golechha et al., or InnerSloth LLC.
