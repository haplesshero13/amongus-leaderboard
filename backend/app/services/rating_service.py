"""OpenSkill rating service for updating model ratings after games."""

from openskill.models import PlackettLuce
from sqlalchemy.orm import Session

from app.models import Model, ModelRating, Game, GameParticipant, PlayerRole


# Configure OpenSkill model
# PlackettLuce is a good default for team-based games
RATING_MODEL = PlackettLuce()


def get_or_create_rating(db: Session, model: Model) -> ModelRating:
    """Get existing rating or create a new one for a model."""
    if model.ratings is not None:
        return model.ratings

    rating = ModelRating(model_id=model.id)
    db.add(rating)
    db.flush()
    model.ratings = rating
    return rating


def update_ratings_for_game(db: Session, game: Game) -> None:
    """
    Update OpenSkill ratings for all participants after a game completes.

    This creates two teams (impostors vs crewmates) and updates each player's
    role-specific rating based on the game outcome.
    """
    if game.winner is None:
        return

    # Separate participants by role
    impostors: list[GameParticipant] = []
    crewmates: list[GameParticipant] = []

    for participant in game.participants:
        if participant.role == PlayerRole.IMPOSTOR:
            impostors.append(participant)
        else:
            crewmates.append(participant)

    # Determine which team won
    impostors_won = game.impostors_won

    # Build OpenSkill rating objects for each team
    impostor_ratings = []
    crewmate_ratings = []

    for p in impostors:
        model_rating = get_or_create_rating(db, p.model)
        os_rating = RATING_MODEL.rating(
            mu=model_rating.impostor_mu, sigma=model_rating.impostor_sigma
        )
        impostor_ratings.append((p, model_rating, os_rating))

    for p in crewmates:
        model_rating = get_or_create_rating(db, p.model)
        os_rating = RATING_MODEL.rating(
            mu=model_rating.crewmate_mu, sigma=model_rating.crewmate_sigma
        )
        crewmate_ratings.append((p, model_rating, os_rating))

    # Create team rating lists
    impostor_team = [r[2] for r in impostor_ratings]
    crewmate_team = [r[2] for r in crewmate_ratings]

    # Calculate new ratings
    # OpenSkill ranks: lower is better, so winner gets rank 1
    if impostors_won:
        ranks = [1, 2]  # Impostors won (rank 1), crewmates lost (rank 2)
    else:
        ranks = [2, 1]  # Impostors lost (rank 2), crewmates won (rank 1)

    new_impostor_team, new_crewmate_team = RATING_MODEL.rate(
        [impostor_team, crewmate_team], ranks=ranks
    )

    # Update impostor ratings
    for i, (participant, model_rating, _) in enumerate(impostor_ratings):
        new_rating = new_impostor_team[i]
        model_rating.impostor_mu = new_rating.mu
        model_rating.impostor_sigma = new_rating.sigma
        model_rating.impostor_games += 1
        participant.won = impostors_won

    # Update crewmate ratings
    for i, (participant, model_rating, _) in enumerate(crewmate_ratings):
        new_rating = new_crewmate_team[i]
        model_rating.crewmate_mu = new_rating.mu
        model_rating.crewmate_sigma = new_rating.sigma
        model_rating.crewmate_games += 1
        participant.won = not impostors_won

    db.flush()


def scale_rating_for_display(mu: float) -> int:
    """
    Scale OpenSkill mu to a display-friendly integer.

    OpenSkill default mu is 25. We multiply by 100 for bigger numbers.
    25 * 100 = 2500 starting rating.
    """
    return round(mu * 100)


def get_model_rankings(db: Session) -> list[dict]:
    """
    Get all models with their ratings, ranked by overall rating.

    Returns a list of dicts ready for the leaderboard API response.
    """
    # Query all models with their ratings
    models = db.query(Model).all()

    rankings = []
    for model in models:
        rating = model.ratings or ModelRating(model_id=model.id)

        rankings.append({
            "model": model,
            "rating": rating,
            "overall": rating.overall_rating,
            "impostor": rating.impostor_rating,
            "crewmate": rating.crewmate_rating,
            "games": rating.total_games,
        })

    # Sort by overall rating descending
    rankings.sort(key=lambda x: x["overall"], reverse=True)

    # Assign ranks
    result = []
    for i, r in enumerate(rankings, start=1):
        model = r["model"]
        rating = r["rating"]

        # Calculate rank change
        previous_rank = rating.previous_rank or i
        rank_change = previous_rank - i

        result.append({
            "model_id": model.model_id,
            "model_name": model.model_name,
            "provider": model.provider,
            "overall_rating": scale_rating_for_display(r["overall"]),
            "impostor_rating": scale_rating_for_display(r["impostor"]),
            "crewmate_rating": scale_rating_for_display(r["crewmate"]),
            "games_played": r["games"],
            "current_rank": i,
            "previous_rank": previous_rank,
            "rank_change": rank_change,
            "release_date": model.release_date.isoformat() if model.release_date else None,
            "avatar_color": model.avatar_color,
        })

    return result


def update_previous_ranks(db: Session) -> None:
    """
    Update previous_rank for all models based on current rankings.

    Call this periodically (e.g., daily) to track rank changes over time.
    """
    rankings = get_model_rankings(db)

    for ranking in rankings:
        model = db.query(Model).filter(Model.model_id == ranking["model_id"]).first()
        if model and model.ratings:
            model.ratings.previous_rank = ranking["current_rank"]

    db.flush()
