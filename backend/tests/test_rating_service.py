"""Tests for the OpenSkill rating service."""

from app.models import Model, ModelRating, Game, GameParticipant, PlayerRole, GameStatus
from app.services.rating_service import (
    update_ratings_for_game,
    scale_rating_for_display,
    get_or_create_rating,
    build_rankings_from_ratings,
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


class TestBuildRankingsFromRatings:
    """Tests for the build_rankings_from_ratings utility."""

    def test_returns_empty_list_when_no_models(self):
        """Should return empty list when no models exist."""
        rankings = build_rankings_from_ratings([], {})
        assert rankings == []

    def test_ranks_by_overall_rating_descending(self, sample_models):
        """Models should be ranked by overall rating, highest first."""
        ratings_map = {
            model.id: ModelRating(
                model_id=model.id,
                impostor_mu=25.0 + i,
                crewmate_mu=25.0 + i,
                impostor_games=1,
                crewmate_games=1,
            )
            for i, model in enumerate(sample_models)
        }

        rankings = build_rankings_from_ratings(sample_models, ratings_map)

        for i in range(len(rankings) - 1):
            assert rankings[i]["overall_rating"] >= rankings[i + 1]["overall_rating"]

        assert rankings[0]["current_rank"] == 1
        assert rankings[-1]["current_rank"] == len(sample_models)

    def test_includes_all_required_fields(self):
        """Rankings should include all fields needed by frontend."""
        model = Model(
            id="test-uuid",
            model_id="test-model",
            model_name="Test Model",
            provider="Test",
            openrouter_id="test/model",
            avatar_color="#FF0000",
        )
        ratings_map = {model.id: ModelRating(model_id=model.id)}

        rankings = build_rankings_from_ratings([model], ratings_map)

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
            "impostor_games",
            "impostor_wins",
            "crewmate_games",
            "crewmate_wins",
            "win_rate",
            "impostor_win_rate",
            "crewmate_win_rate",
            "release_date",
            "avatar_color",
        ]

        for field in required_fields:
            assert field in r, f"Missing field: {field}"

    def test_win_rate_calculation(self, sample_models):
        """Win rates should be calculated correctly as percentages."""
        model = sample_models[0]
        ratings_map = {
            model.id: ModelRating(
                model_id=model.id,
                impostor_mu=50.0,
                crewmate_mu=50.0,
                impostor_games=10,
                impostor_wins=7,
                crewmate_games=20,
                crewmate_wins=12,
            )
        }

        rankings = build_rankings_from_ratings(sample_models, ratings_map)
        r = next(r for r in rankings if r["model_id"] == model.model_id)

        assert r["impostor_win_rate"] == 70.0  # 7/10 = 70%
        assert r["crewmate_win_rate"] == 60.0  # 12/20 = 60%
        # Overall: 19 wins / 30 games = 63.33...%
        assert r["win_rate"] == 63.3


class TestMetaAgentRating:
    """Tests for the meta-agent rating algorithm that handles asymmetric teams."""

    def test_symmetric_rating_changes_for_equal_teams(self, db_session, sample_models):
        """
        When both teams have equal average ratings, winning should give
        roughly symmetric rating changes regardless of team size (2v5).

        This tests the core fix: meta-agent averaging normalizes team strength.
        """
        # Create a game where impostors won
        game = Game(
            status=GameStatus.COMPLETED,
            winner=1,  # Impostors won
            winner_reason="Impostors win!",
        )
        db_session.add(game)
        db_session.flush()

        colors = ["red", "blue", "green", "yellow", "purple", "orange", "pink"]
        for i, model in enumerate(sample_models):
            role = PlayerRole.IMPOSTOR if i < 2 else PlayerRole.CREWMATE
            won = role == PlayerRole.IMPOSTOR
            participant = GameParticipant(
                game_id=game.id,
                model_id=model.id,
                player_number=i + 1,
                player_color=colors[i],
                role=role,
                won=won,
            )
            db_session.add(participant)
            # All start at default 25.0
            get_or_create_rating(db_session, model)

        db_session.flush()
        db_session.refresh(game)

        update_ratings_for_game(db_session, game)

        # Get average rating changes
        impostors = [p for p in game.participants if p.role == PlayerRole.IMPOSTOR]
        crewmates = [p for p in game.participants if p.role == PlayerRole.CREWMATE]

        imp_delta = sum(p.model.ratings.impostor_mu - 25.0 for p in impostors) / len(impostors)
        crew_delta = sum(p.model.ratings.crewmate_mu - 25.0 for p in crewmates) / len(crewmates)

        # Key assertion: deltas should be roughly equal in magnitude (opposite sign)
        # Before the fix, impostor gain was ~27x crewmate loss due to 2v5 asymmetry
        # After fix, they should be nearly equal
        assert abs(imp_delta) > 0, "Impostors should gain rating"
        assert crew_delta < 0, "Crewmates should lose rating"

        # The magnitudes should be close (within 50% of each other)
        # This is much tighter than the 27x asymmetry before
        ratio = abs(imp_delta) / abs(crew_delta)
        assert 0.5 < ratio < 2.0, f"Rating change ratio {ratio} should be close to 1.0"

    def test_variance_weighted_redistribution(self, db_session):
        """
        Players with higher uncertainty (sigma) should receive larger rating updates.

        This is the Bayesian-correct behavior: uncertain players have more room to grow.
        """
        # Create models with different sigmas
        veteran = Model(
            model_id="veteran",
            model_name="Veteran",
            provider="Test",
            openrouter_id="test/veteran",
        )
        newbie = Model(
            model_id="newbie",
            model_name="Newbie",
            provider="Test",
            openrouter_id="test/newbie",
        )
        db_session.add_all([veteran, newbie])
        db_session.flush()

        # Veteran has low sigma (certain), Newbie has high sigma (uncertain)
        veteran_rating = ModelRating(
            model_id=veteran.id,
            impostor_mu=25.0,
            impostor_sigma=2.0,  # Very certain
        )
        newbie_rating = ModelRating(
            model_id=newbie.id,
            impostor_mu=25.0,
            impostor_sigma=8.0,  # Very uncertain
        )
        db_session.add_all([veteran_rating, newbie_rating])
        veteran.ratings = veteran_rating
        newbie.ratings = newbie_rating
        db_session.flush()

        # Create 5 standard crewmates
        crewmates = []
        for i in range(5):
            model = Model(
                model_id=f"crew-{i}",
                model_name=f"Crewmate {i}",
                provider="Test",
                openrouter_id=f"test/crew-{i}",
            )
            db_session.add(model)
            db_session.flush()
            rating = ModelRating(model_id=model.id)
            db_session.add(rating)
            model.ratings = rating
            crewmates.append(model)
        db_session.flush()

        # Create game where impostors (veteran + newbie) win
        game = Game(
            status=GameStatus.COMPLETED,
            winner=1,
            winner_reason="Impostors win!",
        )
        db_session.add(game)
        db_session.flush()

        # Add participants
        colors = ["red", "blue", "green", "yellow", "purple", "orange", "pink"]
        for i, model in enumerate([veteran, newbie] + crewmates):
            role = PlayerRole.IMPOSTOR if i < 2 else PlayerRole.CREWMATE
            participant = GameParticipant(
                game_id=game.id,
                model_id=model.id,
                player_number=i + 1,
                player_color=colors[i],
                role=role,
                won=(role == PlayerRole.IMPOSTOR),
            )
            db_session.add(participant)
        db_session.flush()
        db_session.refresh(game)

        # Record initial values
        veteran_initial = veteran_rating.impostor_mu
        newbie_initial = newbie_rating.impostor_mu

        update_ratings_for_game(db_session, game)

        db_session.refresh(veteran_rating)
        db_session.refresh(newbie_rating)

        veteran_delta = veteran_rating.impostor_mu - veteran_initial
        newbie_delta = newbie_rating.impostor_mu - newbie_initial

        # Key assertion: newbie (high sigma) should gain MORE than veteran (low sigma)
        assert newbie_delta > veteran_delta, (
            f"High-sigma player should gain more: newbie={newbie_delta:.4f}, "
            f"veteran={veteran_delta:.4f}"
        )

        # Both should gain (they won)
        assert veteran_delta > 0, "Veteran should gain rating"
        assert newbie_delta > 0, "Newbie should gain rating"

        # The ratio should roughly match the variance ratio (8^2 / 2^2 = 16)
        # But it won't be exact due to the algorithm, so we just check newbie > veteran
        ratio = newbie_delta / veteran_delta
        assert ratio > 2.0, f"Newbie should gain significantly more, ratio={ratio:.2f}"

    def test_sigma_decreases_after_game(self, db_session, sample_game_with_participants):
        """Sigma (uncertainty) should decrease after each game."""
        game = sample_game_with_participants

        # Initialize ratings and record initial sigmas
        initial_sigmas = {}
        for p in game.participants:
            rating = get_or_create_rating(db_session, p.model)
            if p.role == PlayerRole.IMPOSTOR:
                initial_sigmas[p.model.id] = rating.impostor_sigma
            else:
                initial_sigmas[p.model.id] = rating.crewmate_sigma
        db_session.flush()

        update_ratings_for_game(db_session, game)

        # Check sigma decreased for all players
        for p in game.participants:
            db_session.refresh(p.model.ratings)
            if p.role == PlayerRole.IMPOSTOR:
                new_sigma = p.model.ratings.impostor_sigma
            else:
                new_sigma = p.model.ratings.crewmate_sigma

            assert new_sigma < initial_sigmas[p.model.id], (
                f"Sigma should decrease after game: {new_sigma} >= {initial_sigmas[p.model.id]}"
            )

    def test_wins_tracked_correctly(self, db_session, sample_game_with_participants):
        """Win counts should be tracked correctly for winners only."""
        game = sample_game_with_participants
        assert game.winner == 1  # Impostors won

        for p in game.participants:
            get_or_create_rating(db_session, p.model)
        db_session.flush()

        update_ratings_for_game(db_session, game)

        for p in game.participants:
            db_session.refresh(p.model.ratings)
            if p.role == PlayerRole.IMPOSTOR:
                assert p.model.ratings.impostor_wins == 1, "Impostor should have 1 win"
                assert p.model.ratings.crewmate_wins == 0, "No crewmate wins"
            else:
                assert p.model.ratings.crewmate_wins == 0, "Crewmate should have 0 wins (lost)"
                assert p.model.ratings.impostor_wins == 0, "No impostor wins"
