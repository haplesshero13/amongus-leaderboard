import random
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from app.models import Game, GameParticipant, GameStatus, Model, PlayerRole
from app.core.constants import CURRENT_ENGINE_VERSION


def select_participants(db: Session, num_players: int = 7) -> list[str]:
    """
    Select participants for a new game to balance participation.

    Returns a list of 7 model UUIDs.
    The first 2 are the intended Impostors.
    The remaining 5 are Crewmates.
    """
    # 1. Get all models
    models = db.query(Model).all()
    if len(models) < num_players:
        raise ValueError(f"Not enough models. Need {num_players}, have {len(models)}")

    all_model_ids = [m.id for m in models]

    # 2. Get participation counts (completed games)
    participant_counts = {mid: 0 for mid in all_model_ids}
    impostor_counts = {mid: 0 for mid in all_model_ids}

    # Only count stats from the current engine version (season)
    stats = (
        db.query(
            GameParticipant.model_id,
            func.count(GameParticipant.id).label("total"),
            func.sum(case((GameParticipant.role == PlayerRole.IMPOSTOR, 1), else_=0)).label(
                "impostor"
            ),
        )
        .join(Game)
        .filter(Game.engine_version == CURRENT_ENGINE_VERSION)
        .group_by(GameParticipant.model_id)
        .all()
    )

    for s in stats:
        if s.model_id in participant_counts:
            participant_counts[s.model_id] = s.total
            impostor_counts[s.model_id] = s.impostor or 0

    # 3. Get participation counts (active games)
    # Also filter active games by engine version
    active_games = (
        db.query(Game)
        .filter(
            Game.status.in_([GameStatus.PENDING, GameStatus.RUNNING]),
            Game.engine_version == CURRENT_ENGINE_VERSION,
        )
        .all()
    )

    for game in active_games:
        if game.model_ids:
            # game.model_ids is a list of UUIDs
            for i, mid in enumerate(game.model_ids):
                if mid in participant_counts:
                    participant_counts[mid] += 1

                # Assume indices 0 and 1 are Impostors for active games.
                # This is accurate for matchmade games (randomize_roles=False).
                # For manually triggered games (randomize_roles=True), model_ids
                # initially reflects the caller's order while PENDING, then gets
                # overwritten with the shuffled order once RUNNING. So this is
                # only a heuristic for PENDING manually-triggered games, but in
                # practice we run 1 game at a time so overlap is unlikely.
                if i < 2 and mid in impostor_counts:
                    impostor_counts[mid] += 1

    # 4. Select top candidates by total games played
    # Sort by: count ASC, then random (to break ties)

    # Create a list of (model_id, count)
    candidates = [(mid, participant_counts[mid]) for mid in all_model_ids]
    random.shuffle(candidates)  # Shuffle first to randomize ties
    candidates.sort(key=lambda x: x[1])  # Stable sort

    selected_candidates = candidates[:num_players]
    selected_ids = [c[0] for c in selected_candidates]

    # 5. Assign roles (Impostors = least impostor games)
    # Filter impostor counts for selected models
    selected_impostor_counts = [(mid, impostor_counts[mid]) for mid in selected_ids]
    random.shuffle(selected_impostor_counts)  # Shuffle for ties
    selected_impostor_counts.sort(key=lambda x: x[1])

    # First 2 are impostors
    impostors = [x[0] for x in selected_impostor_counts[:2]]
    crewmates = [x[0] for x in selected_impostor_counts[2:]]

    # Return ordered list: Impostors first, then Crewmates
    return impostors + crewmates
