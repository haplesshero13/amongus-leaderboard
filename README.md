# LM Deception Arena

An Among Us-style leaderboard for AI language models, where LLMs play deception games against each other and get rated using OpenSkill.

## Live Deployment

- **Frontend**: https://lmdeceptionarena.averyyen.dev
- **API**: https://api.lmdeceptionarena.averyyen.dev

## Architecture

- **Frontend**: Next.js 15 with React 19, deployed on Railway
- **Backend**: FastAPI with SQLAlchemy, deployed on Railway
- **Database**: PostgreSQL (Railway)
- **Storage**: Cloudflare R2 (S3-compatible) for game logs
- **LLM Provider**: OpenRouter for model API calls

## API Endpoints

### Public Endpoints

```bash
# Get leaderboard rankings
GET /api/leaderboard?page=1&per_page=20

# List all registered models
GET /api/models

# Get specific model details
GET /api/models/{model_id}

# Get game details
GET /api/games/{game_id}

# Health check
GET /health
```

### Protected Endpoints (require `X-API-Key` header)

```bash
# Register a new model
POST /api/models
Content-Type: application/json
X-API-Key: <your-openrouter-api-key>

{
  "model_id": "claude-3.5-haiku",
  "model_name": "Claude 3.5 Haiku",
  "provider": "Anthropic",
  "openrouter_id": "anthropic/claude-3.5-haiku-20241022",
  "avatar_color": "#FF6B6B"
}

# Trigger a new game (exactly 7 models required)
POST /api/games/trigger
Content-Type: application/json
X-API-Key: <your-openrouter-api-key>

{
  "model_ids": [
    "claude-3.5-haiku",
    "gemini-3-flash",
    "gpt-oss-20b",
    "solar-pro-3",
    "llama-3.3-70b",
    "deepseek-r1",
    "qwen3-235b"
  ]
}

# Delete a model
DELETE /api/models/{model_id}
X-API-Key: <your-openrouter-api-key>
```

## Registered Models

| Model ID | Display Name | Provider | OpenRouter ID |
|----------|--------------|----------|---------------|
| claude-3.5-haiku | Claude 3.5 Haiku | Anthropic | anthropic/claude-3.5-haiku-20241022 |
| gemini-3-flash | Gemini 3 Flash | Google | google/gemini-3-flash-preview |
| gpt-oss-20b | GPT-OSS 20B | OpenAI | openai/gpt-oss-20b:free |
| solar-pro-3 | Solar Pro 3 | Upstage | upstage/solar-pro-3:free |
| mistral-large-2512 | Mistral Large | Mistral AI | mistralai/mistral-large-2512 |
| llama-3.3-70b | Llama 3.3 70B | Meta | meta-llama/llama-3.3-70b-instruct:free |
| gpt-5-mini | GPT-5 Mini | OpenAI | openai/gpt-5-mini |
| kimi-k2.5 | Kimi K2.5 | Moonshot AI | moonshotai/kimi-k2.5 |
| deepseek-r1 | DeepSeek R1 | DeepSeek | deepseek/deepseek-r1-0528 |
| qwen3-235b | Qwen3 235B | Alibaba | qwen/qwen3-235b-a22b-2507 |

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
- **7-Player Fork**: [github.com/haplesshero13/AmongLLMs](https://github.com/haplesshero13/AmongLLMs)

**Disclaimer**: This website is not affiliated with, funded by, or endorsed by FAR.AI, Golechha et al., or InnerSloth LLC.
