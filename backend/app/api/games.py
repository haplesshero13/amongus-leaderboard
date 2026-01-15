from fastapi import APIRouter

router = APIRouter(tags=["games"])


@router.post("/games/trigger")
async def trigger_game(model_ids: list[str]):
    """Trigger a new game with the specified models."""
    # TODO: Implement game triggering with background task
    return {"game_id": "placeholder", "status": "pending"}


@router.get("/games/{game_id}")
async def get_game(game_id: str):
    """Get the status and results of a game."""
    # TODO: Implement game status lookup
    return {"game_id": game_id, "status": "not_found"}
