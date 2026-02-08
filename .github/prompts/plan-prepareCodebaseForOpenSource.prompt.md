# Plan: Prepare Codebase for Open-Source

**TL;DR:** Remove 3 critical hard-coded blockers (API URLs, model list, CORS origins) and 2 HIGH-priority configuration items (webhook timeout, S3 retry logic). Make run_games.py dynamically fetch models from backend, extend GET /api/models to include game participation counts, and change the GitHub workflow from 5 games/day to 1 game daily at 1200 UTC with balanced model selection.

---

## **Steps**

### **Phase 1: Backend API Enhancements** (Foundation for dynamic config) [DONE]

1. **Extend `GET /api/models` response schema** in app/api/models.py
   - Add `games_played_by_season` field to model response
   - Update `ModelResponse` schema in app/api/schemas.py 
   - Query database to count how many games each model has participated in for each season
   - Existing endpoint should work, but response structure changes slightly

2. **Make webhook timeout and S3 retry logic configurable** [DONE]
   - Add to app/core/config.py:
     - `WEBHOOK_TIMEOUT: float = 10.0` (env: `WEBHOOK_TIMEOUT`)
     - `S3_MAX_RETRIES: int = 3` (env: `S3_MAX_RETRIES`)
     - `S3_RETRY_DELAY: float = 1.0` (env: `S3_RETRY_DELAY`)
   - Update app/services/game_runner.py to use these from config instead of hard-coded values

### **Phase 1.5: Frontend Season Awareness** [DONE]

3. **Update Stats Bar to respect seasons**
   - Ensure the total games count on the front page reflects the current season by default
   - Update frontend data fetching to support season filtering

4. **Add Season Filter to Games List**
   - Add a season selector dropdown to the games list page
   - Use `GET /api/seasons` to populate the dropdown
   - Filter `GET /api/games` calls using the `engine_version` parameter

### **Phase 2: Backend Configuration Cleanup** (Critical blockers) [STARTED]

3. **Move hard-coded API URL to environment variable** [DONE]
   - Add to app/core/config.py: `API_URL: str = Field(default="http://localhost:8000", env="API_URL")`
   - Used for any internal health checks or documentation generation
   - Update .github/workflows/deploy.yml to use GitHub variables or secrets

4. **Make CORS origins environment-configurable** [DONE]
   - Add to app/core/config.py:
     - `CORS_ORIGINS: list[str] = Field(default=["http://localhost:3000"], env="CORS_ORIGINS")`
     - Parse comma-separated string from environment
   - Update app/main.py to use `settings.cors_origins` instead of hard-coded list

### **Phase 3: Script Refactoring** (Core requirement)

5. **Refactor backend/scripts/run_games.py to query models dynamically**
   - Remove hard-coded `MODELS` list (lines 33-67)
   - Add new function `async def fetch_available_models(api_url: str, api_key: str) -> list[dict]:`
     - Calls `GET {api_url}/api/models` to fetch all registered models
     - Returns list with `model_id` and `games_played_by_season` fields
   - Update `generate_balanced_games()` to:
     - Accept fetched models list as parameter
     - Sort by `games_played_by_season` (using the latest season, ascending by game count) instead of the MODELS list
     - Still pick the 7 least-played for each game
   - Update `main()` to fetch models before generating games
   - Keep same balancing logic (least-played selection)

6. **Refactor scripts/validate_games.py to use API_URL env var**
   - Change default from hardcoded `http://localhost:8000` to `os.environ.get("API_URL", "http://localhost:8000")`
   - Update `get_api_url()` function to check env var first

7. **Update scripts/register_new_models.sh**
   - Change hard-coded API URL to use `${API_URL:-http://localhost:8000}` pattern

### **Phase 4: GitHub Workflow Updates** (Schedule change)

8. **Create new daily game workflow** .github/workflows/run-daily-game.yml
   - Cron schedule: `0 12 * * *` (1200 UTC daily)
   - Trigger: Call `{API_URL}/api/games/trigger` with models fetched from `GET /api/models`
   - Select 7 least-played models from the response
   - Requires `OPENROUTER_API_KEY` secret and `API_URL` variable
   - Use same logic as refactored run_games.py script

9. **Deprecate/update old interval workflow** .github/workflows/run-games.yml
   - Either remove it or mark as manual-trigger only (no schedule)
   - Document that users should use new daily workflow instead

### **Phase 5: Documentation & Examples**

10. **Create/update `.env.example` files**
    - Backend: Add `API_URL`, `CORS_ORIGINS`, `WEBHOOK_TIMEOUT`, `S3_MAX_RETRIES`, `S3_RETRY_DELAY`
    - Frontend: Document `NEXT_PUBLIC_API_URL` usage

11. **Update README.md** with:
    - Configuration variables section
    - How to use `run_games.py` with custom models (it now queries backend automatically)
    - GitHub Actions setup (API key, API_URL variable)
    - Explanation that models are registered dynamically, not hard-coded

### **Phase 6: Testing & Verification**

12. **Test the refactored run_games.py locally:**
    ```bash
    # Register test models via API first
    # Run against local backend
    python backend/scripts/run_games.py --dry-run
    python backend/scripts/run_games.py --games 1 --api-url http://localhost:8000
    ```

13. **Verify configuration via environment:**
    ```bash
    # Test ENV settings
    API_URL=https://example.com python backend/scripts/run_games.py --dry-run
    CORS_ORIGINS="https://example.com,http://localhost:3000" pytest backend/tests/
    ```

14. **Test workflow in staging environment**
    - Set up GitHub variables/secrets
    - Manual workflow trigger to verify API calls work

---

## **Verification**

**Unit Tests:**
- Add test for `fetch_available_models()` in tests/test_game_runner.py
- Add test for models list with `games_played_by_season` field in test_api_endpoints.py
- Verify balancing logic still selects least-played when called with fetched models

**Integration Tests:**
- Run `run_games.py --dry-run` against staging backend—should display fetched models
- Verify `GET /api/models` returns new `games_played_by_season` field for each model

**Manual Checks:**
- Deploy to staging environment with different `CORS_ORIGINS` env var—verify frontend can connect
- Verify GitHub workflow runs daily at 1200 UTC and creates game successfully
- Check that adding a new model to backend automatically makes it available for games (no code changes needed)

---

## **Decisions**

- **Extend existing `GET /api/models` endpoint** with `games_played_by_season` field instead of creating a separate endpoint—simpler, less API surface
- **Keep load-balancing logic even for single daily game**—ensures fair model distribution over time, not just random luck
- **Environment variables for all configuration**—allows docker-compose, Railway, and any host to configure without rebuilding
- **Deprecate old 5x/day schedule**—cleaner for open-source (easier to understand, can use cron jobs yourself if desired)
- **Scope includes HIGH priority items** (webhook timeout, S3 retries)—low implementation cost, improves robustness for self-hosted instances
