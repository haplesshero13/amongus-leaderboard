from fastapi import APIRouter

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard")
async def get_leaderboard(page: int = 1, per_page: int = 20):
    """Get the leaderboard with paginated model rankings."""
    # TODO: Implement with real database query
    return {
        "data": [],
        "total": 0,
        "page": page,
        "per_page": per_page,
        "total_pages": 0,
    }
