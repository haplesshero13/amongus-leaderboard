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
        """Overall rating should be simple average when no games played."""
        rating = ModelRating(
            model_id="test",
            impostor_mu=30.0,
            crewmate_mu=20.0,
            impostor_games=0,
            crewmate_games=0,
        )
        assert rating.overall_rating == 25.0  # (30 + 20) / 2

    def test_overall_rating_weighted_by_games(self):
        """Overall rating is weighted by games played."""
        rating = ModelRating(
            model_id="test",
            impostor_mu=30.0,
            crewmate_mu=20.0,
            impostor_games=3,
            crewmate_games=7,
        )
        # Weighted: (30 * 3 + 20 * 7) / 10 = 23
        assert rating.overall_rating == 23.0

    def test_overall_rating_unplayed_role_counts_as_one_game(self):
        """Unplayed role counts as 1 game at default rating."""
        rating = ModelRating(
            model_id="test",
            impostor_mu=25.0,  # Default, never played
            crewmate_mu=35.0,
            impostor_games=0,
            crewmate_games=10,
        )
        # imp_weight=1, crew_weight=10, total=11
        # (25 * 1 + 35 * 10) / 11 = 375 / 11 ≈ 34.09
        assert abs(rating.overall_rating - 34.09) < 0.01

    def test_overall_rating_unplayed_crewmate_counts_as_one_game(self):
        """Unplayed crewmate role counts as 1 game at default rating."""
        rating = ModelRating(
            model_id="test",
            impostor_mu=35.0,
            crewmate_mu=25.0,  # Default, never played
            impostor_games=10,
            crewmate_games=0,
        )
        # imp_weight=10, crew_weight=1, total=11
        # (35 * 10 + 25 * 1) / 11 = 375 / 11 ≈ 34.09
        assert abs(rating.overall_rating - 34.09) < 0.01

    def test_overall_rating_equal_games_is_simple_average(self):
        """Equal games means simple average."""
        rating = ModelRating(
            model_id="test",
            impostor_mu=30.0,
            crewmate_mu=20.0,
            impostor_games=5,
            crewmate_games=5,
        )
        assert rating.overall_rating == 25.0


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
