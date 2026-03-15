from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.schemas import LeaderboardResponse, ModelRankingResponse, SeasonResponse
from app.core.constants import CURRENT_ENGINE_VERSION, SEASON_LABELS
from app.core.database import get_db
from app.models import Game, GameStatus
from app.services.rating_service import get_historical_rankings

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    engine_version: int | None = Query(None, description="Filter by engine version / season"),
    db: Session = Depends(get_db),
):
    """
    Get the leaderboard with paginated model rankings.

    Returns models ranked by overall OpenSkill rating, with pagination.
    When engine_version is None, returns current season rankings.
    When engine_version is specified, replays that season's games in memory.
    """
    target_version = CURRENT_ENGINE_VERSION if engine_version is None else engine_version
    all_rankings = get_historical_rankings(db, target_version)

    total = len(all_rankings)
    total_pages = (total + per_page - 1) // per_page if total > 0 else 0

    # Paginate
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    page_rankings = all_rankings[start_idx:end_idx]

    return LeaderboardResponse(
        data=[ModelRankingResponse(**r) for r in page_rankings],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/seasons", response_model=list[SeasonResponse])
async def list_seasons(db: Session = Depends(get_db)):
    """
    List all available seasons with game counts.

    Returns seasons sorted by version descending (current season first).
    """
    # Count completed games per engine_version
    counts = (
        db.query(Game.engine_version, func.count(Game.id))
        .filter(Game.status == GameStatus.COMPLETED)
        .group_by(Game.engine_version)
        .all()
    )
    count_map = dict(counts)

    seasons = []
    for version, label in sorted(SEASON_LABELS.items(), reverse=True):
        seasons.append(
            SeasonResponse(
                version=version,
                label=label,
                game_count=count_map.get(version, 0),
            )
        )

    return seasons
