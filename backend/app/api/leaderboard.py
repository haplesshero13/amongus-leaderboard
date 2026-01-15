from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.schemas import LeaderboardResponse, ModelRankingResponse
from app.core.database import get_db
from app.services.rating_service import get_model_rankings

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    """
    Get the leaderboard with paginated model rankings.

    Returns models ranked by overall OpenSkill rating, with pagination.
    """
    # Get all rankings (sorted by overall rating)
    all_rankings = get_model_rankings(db)

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
