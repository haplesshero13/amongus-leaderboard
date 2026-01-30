"""Tests for database model properties and calculations."""

from app.models import ModelRating, Game, GameWinner


class TestModelRatingProperties:
    """Tests for ModelRating computed properties."""

    def test_total_games_sum(self):
        """Total games should be sum of impostor and crewmate games."""
        rating = ModelRating(
            model_id="test",
            impostor_games=5,
            crewmate_games=10,
        )
        assert rating.total_games == 15

    def test_total_games_zero_when_no_games(self):
        """Total games should be 0 when no games played."""
        rating = ModelRating(model_id="test")
        assert rating.total_games == 0

    def test_impostor_rating_returns_mu(self):
        """Impostor rating should return impostor_mu."""
        rating = ModelRating(model_id="test", impostor_mu=30.0)
        assert rating.impostor_rating == 30.0

    def test_crewmate_rating_returns_mu(self):
        """Crewmate rating should return crewmate_mu."""
        rating = ModelRating(model_id="test", crewmate_mu=28.5)
        assert rating.crewmate_rating == 28.5

    def test_overall_rating_simple_average_when_no_games(self):
        """Overall rating should be simple average when no games played (same sigma)."""
        rating = ModelRating(
            model_id="test",
            impostor_mu=30.0,
            impostor_sigma=ModelRating.DEFAULT_SIGMA,
            crewmate_mu=20.0,
            crewmate_sigma=ModelRating.DEFAULT_SIGMA,
            impostor_games=0,
            crewmate_games=0,
        )
        # Same sigma = same weight, so simple average
        assert rating.overall_rating == 25.0  # (30 + 20) / 2

    def test_overall_rating_weighted_by_confidence(self):
        """Overall rating is weighted by confidence (1/sigma)."""
        rating = ModelRating(
            model_id="test",
            impostor_mu=30.0,
            impostor_sigma=2.0,  # Higher confidence (lower sigma)
            crewmate_mu=20.0,
            crewmate_sigma=4.0,  # Lower confidence (higher sigma)
            impostor_games=10,
            crewmate_games=3,
        )
        # imp_weight = 1/2.0 = 0.5, crew_weight = 1/4.0 = 0.25
        # (30 * 0.5 + 20 * 0.25) / (0.5 + 0.25) = 20/0.75 = 26.67
        assert abs(rating.overall_rating - 26.67) < 0.01

    def test_overall_rating_unplayed_role_has_less_weight(self):
        """Unplayed role has high sigma and thus less weight."""
        rating = ModelRating(
            model_id="test",
            impostor_mu=25.0,  # Default, never played
            impostor_sigma=ModelRating.DEFAULT_SIGMA,  # High sigma (8.333)
            crewmate_mu=35.0,
            crewmate_sigma=2.0,  # Low sigma (played many games)
            impostor_games=0,
            crewmate_games=10,
        )
        # imp_weight = 1/8.333 ≈ 0.12, crew_weight = 1/2.0 = 0.5
        # Crewmate rating dominates due to higher confidence
        # (25 * 0.12 + 35 * 0.5) / (0.12 + 0.5) ≈ 33.06
        assert abs(rating.overall_rating - 33.06) < 0.1

    def test_overall_rating_unplayed_crewmate_has_less_weight(self):
        """Unplayed crewmate role has high sigma and thus less weight."""
        rating = ModelRating(
            model_id="test",
            impostor_mu=35.0,
            impostor_sigma=2.0,  # Low sigma (played many games)
            crewmate_mu=25.0,  # Default, never played
            crewmate_sigma=ModelRating.DEFAULT_SIGMA,  # High sigma (8.333)
            impostor_games=10,
            crewmate_games=0,
        )
        # imp_weight = 1/2.0 = 0.5, crew_weight = 1/8.333 ≈ 0.12
        # Impostor rating dominates due to higher confidence
        # (35 * 0.5 + 25 * 0.12) / (0.5 + 0.12) ≈ 33.06
        assert abs(rating.overall_rating - 33.06) < 0.1

    def test_overall_rating_equal_sigma_is_simple_average(self):
        """Equal sigma (confidence) means simple average."""
        rating = ModelRating(
            model_id="test",
            impostor_mu=30.0,
            impostor_sigma=3.0,
            crewmate_mu=20.0,
            crewmate_sigma=3.0,
            impostor_games=5,
            crewmate_games=5,
        )
        assert abs(rating.overall_rating - 25.0) < 0.01


class TestGameProperties:
    """Tests for Game computed properties."""

    def test_impostors_won_code_1(self):
        """Winner code 1 (outnumbered) should be impostor win."""
        game = Game(winner=GameWinner.IMPOSTORS_OUTNUMBER.value)
        assert game.impostors_won is True
        assert game.crewmates_won is False

    def test_impostors_won_code_4(self):
        """Winner code 4 (time limit) should be impostor win."""
        game = Game(winner=GameWinner.IMPOSTORS_TIME_LIMIT.value)
        assert game.impostors_won is True
        assert game.crewmates_won is False

    def test_crewmates_won_code_2(self):
        """Winner code 2 (eliminated impostors) should be crewmate win."""
        game = Game(winner=GameWinner.CREWMATES_ELIMINATED_IMPOSTORS.value)
        assert game.crewmates_won is True
        assert game.impostors_won is False

    def test_crewmates_won_code_3(self):
        """Winner code 3 (completed tasks) should be crewmate win."""
        game = Game(winner=GameWinner.CREWMATES_TASKS_COMPLETED.value)
        assert game.crewmates_won is True
        assert game.impostors_won is False

    def test_no_winner_yet(self):
        """When winner is None, both properties should be False."""
        game = Game(winner=None)
        assert game.impostors_won is False
        assert game.crewmates_won is False
