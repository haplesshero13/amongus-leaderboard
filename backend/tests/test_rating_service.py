"""Tests for the OpenSkill rating service."""

from app.models import Model, ModelRating, Game, GameParticipant, PlayerRole, GameStatus
from app.services.rating_service import (
    update_ratings_for_game,
    scale_rating_for_display,
    get_or_create_rating,
    get_model_rankings,
)


class TestScaleRatingForDisplay:
    """Tests for rating display scaling."""

    def test_default_rating_scales_to_2500(self):
        """Default mu of 25 should scale to 2500."""
        assert scale_rating_for_display(25.0) == 2500

    def test_zero_scales_to_zero(self):
        """Zero mu should scale to 0."""
        assert scale_rating_for_display(0.0) == 0

    def test_high_rating_scales_correctly(self):
        """Higher mu values should scale proportionally."""
        assert scale_rating_for_display(30.0) == 3000
        assert scale_rating_for_display(35.5) == 3550

    def test_rounds_to_integer(self):
        """Ratings should be rounded to integers."""
        assert scale_rating_for_display(25.123) == 2512
        assert scale_rating_for_display(25.999) == 2600


class TestGetOrCreateRating:
    """Tests for get_or_create_rating function."""

    def test_creates_new_rating_if_none_exists(self, db_session, sample_models):
        """Should create a new rating if model has none."""
        model = sample_models[0]
        assert model.ratings is None

        rating = get_or_create_rating(db_session, model)

        assert rating is not None
        assert rating.model_id == model.id
        assert rating.impostor_mu == 25.0
        assert rating.crewmate_mu == 25.0

    def test_returns_existing_rating(self, db_session, sample_models):
        """Should return existing rating if model already has one."""
        model = sample_models[0]

        # Create initial rating
        rating1 = get_or_create_rating(db_session, model)
        rating1.impostor_mu = 30.0
        db_session.flush()

        # Get rating again
        rating2 = get_or_create_rating(db_session, model)

        assert rating2.id == rating1.id
        assert rating2.impostor_mu == 30.0


class TestUpdateRatingsForGame:
    """Tests for updating ratings after a game."""

    def test_impostor_win_increases_impostor_ratings(
        self, db_session, sample_game_with_participants
    ):
        """When impostors win, impostor mu should increase."""
        game = sample_game_with_participants
        assert game.winner == 1  # Impostors won

        # Get initial ratings
        impostors = [p for p in game.participants if p.role == PlayerRole.IMPOSTOR]
        for p in impostors:
            get_or_create_rating(db_session, p.model)
        db_session.flush()

        initial_mus = {p.model.id: p.model.ratings.impostor_mu for p in impostors}

        # Update ratings
        update_ratings_for_game(db_session, game)

        # Check that impostor ratings increased
        for p in impostors:
            db_session.refresh(p.model.ratings)
            assert p.model.ratings.impostor_mu > initial_mus[p.model.id]
            assert p.model.ratings.impostor_games == 1
            assert p.won is True

    def test_impostor_win_decreases_crewmate_ratings(
        self, db_session, sample_game_with_participants
    ):
        """When impostors win, crewmate mu should decrease."""
        game = sample_game_with_participants
        assert game.winner == 1  # Impostors won

        # Get initial ratings
        crewmates = [p for p in game.participants if p.role == PlayerRole.CREWMATE]
        for p in crewmates:
            get_or_create_rating(db_session, p.model)
        db_session.flush()

        initial_mus = {p.model.id: p.model.ratings.crewmate_mu for p in crewmates}

        # Update ratings
        update_ratings_for_game(db_session, game)

        # Check that crewmate ratings decreased
        for p in crewmates:
            db_session.refresh(p.model.ratings)
            assert p.model.ratings.crewmate_mu < initial_mus[p.model.id]
            assert p.model.ratings.crewmate_games == 1
            assert p.won is False

    def test_crewmate_win_updates_ratings_correctly(self, db_session, sample_models):
        """When crewmates win, crewmate ratings should increase."""
        # Create a game where crewmates won
        game = Game(
            status=GameStatus.COMPLETED,
            winner=2,  # Crewmates eliminated all impostors
            winner_reason="Crewmates win!",
        )
        db_session.add(game)
        db_session.flush()

        colors = ["red", "blue", "green", "yellow", "purple", "orange", "pink"]
        for i, model in enumerate(sample_models):
            role = PlayerRole.IMPOSTOR if i < 2 else PlayerRole.CREWMATE
            won = role == PlayerRole.CREWMATE  # Crewmates won this game
            participant = GameParticipant(
                game_id=game.id,
                model_id=model.id,
                player_number=i + 1,
                player_color=colors[i],
                role=role,
                won=won,
            )
            db_session.add(participant)
            get_or_create_rating(db_session, model)

        db_session.flush()
        db_session.refresh(game)

        # Update ratings
        update_ratings_for_game(db_session, game)

        # Check crewmates won
        crewmates = [p for p in game.participants if p.role == PlayerRole.CREWMATE]
        for p in crewmates:
            assert p.won is True
            assert p.model.ratings.crewmate_mu > 25.0  # Increased from default

        # Check impostors lost
        impostors = [p for p in game.participants if p.role == PlayerRole.IMPOSTOR]
        for p in impostors:
            assert p.won is False
            assert p.model.ratings.impostor_mu < 25.0  # Decreased from default

    def test_no_update_when_winner_is_none(self, db_session, sample_models):
        """Should not update ratings if game has no winner."""
        game = Game(status=GameStatus.RUNNING, winner=None)
        db_session.add(game)
        db_session.flush()

        # Add one participant with rating
        model = sample_models[0]
        rating = get_or_create_rating(db_session, model)
        initial_mu = rating.impostor_mu

        participant = GameParticipant(
            game_id=game.id,
            model_id=model.id,
            player_number=1,
            player_color="red",
            role=PlayerRole.IMPOSTOR,
        )
        db_session.add(participant)
        db_session.flush()

        # Try to update ratings
        update_ratings_for_game(db_session, game)

        # Rating should be unchanged
        db_session.refresh(rating)
        assert rating.impostor_mu == initial_mu
        assert rating.impostor_games == 0

    def test_game_count_increments(self, db_session, sample_game_with_participants):
        """Game count should increment for each participant."""
        game = sample_game_with_participants

        # Initialize ratings
        for p in game.participants:
            get_or_create_rating(db_session, p.model)
        db_session.flush()

        update_ratings_for_game(db_session, game)

        for p in game.participants:
            db_session.refresh(p.model.ratings)
            if p.role == PlayerRole.IMPOSTOR:
                assert p.model.ratings.impostor_games == 1
                assert p.model.ratings.crewmate_games == 0
            else:
                assert p.model.ratings.crewmate_games == 1
                assert p.model.ratings.impostor_games == 0


class TestGetModelRankings:
    """Tests for getting model rankings."""

    def test_returns_empty_list_when_no_models(self, db_session):
        """Should return empty list when no models exist."""
        rankings = get_model_rankings(db_session)
        assert rankings == []

    def test_ranks_by_overall_rating_descending(self, db_session, sample_models):
        """Models should be ranked by overall rating, highest first."""
        # Set different ratings for each model
        for i, model in enumerate(sample_models):
            rating = ModelRating(
                model_id=model.id,
                impostor_mu=25.0 + i,  # Increasing ratings
                crewmate_mu=25.0 + i,
                impostor_games=1,
                crewmate_games=1,
            )
            db_session.add(rating)
            model.ratings = rating

        db_session.flush()

        rankings = get_model_rankings(db_session)

        # Should be sorted descending by overall rating
        for i in range(len(rankings) - 1):
            assert rankings[i]["overall_rating"] >= rankings[i + 1]["overall_rating"]

        # First model should have rank 1
        assert rankings[0]["current_rank"] == 1
        assert rankings[-1]["current_rank"] == len(sample_models)

    def test_includes_all_required_fields(self, db_session):
        """Rankings should include all fields needed by frontend."""
        model = Model(
            model_id="test-model",
            model_name="Test Model",
            provider="Test",
            openrouter_id="test/model",
            avatar_color="#FF0000",
        )
        db_session.add(model)
        db_session.flush()

        rating = ModelRating(model_id=model.id)
        db_session.add(rating)
        model.ratings = rating
        db_session.flush()

        rankings = get_model_rankings(db_session)

        assert len(rankings) == 1
        r = rankings[0]

        required_fields = [
            "model_id",
            "model_name",
            "provider",
            "overall_rating",
            "impostor_rating",
            "crewmate_rating",
            "games_played",
            "current_rank",
            "previous_rank",
            "rank_change",
            "release_date",
            "avatar_color",
        ]

        for field in required_fields:
            assert field in r, f"Missing field: {field}"

    def test_rank_change_calculation(self, db_session, sample_models):
        """Rank change should be previous_rank - current_rank."""
        model = sample_models[0]
        rating = ModelRating(model_id=model.id, previous_rank=5)
        db_session.add(rating)
        model.ratings = rating
        db_session.flush()

        rankings = get_model_rankings(db_session)

        # Model is rank 1 now, was rank 5 before
        assert rankings[0]["current_rank"] == 1
        assert rankings[0]["previous_rank"] == 5
        assert rankings[0]["rank_change"] == 4  # Moved up 4 spots
