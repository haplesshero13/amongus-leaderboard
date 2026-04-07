"""Tests for sync_bucket_logs — the R2 experiment log ingestion script."""

import json
import os
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

# Ensure test DB before any settings import
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.core.database import Base
from app.models import Game, GameParticipant, GameStatus, Model, ModelRating, PlayerRole
from scripts.sync_bucket_logs import (
    EXPERIMENT_BUCKET,
    HUMAN_AVATAR_COLOR,
    HUMAN_MODEL_ID,
    HUMAN_MODEL_NAME,
    HUMAN_OPENROUTER_ID,
    HUMAN_PROVIDER,
    _log_entry_key,
    create_game_from_summary,
    download_text,
    ensure_human_model,
    get_model_by_openrouter_id,
    parse_agent_logs_json,
    parse_agent_logs_jsonl,
    parse_summary_jsonl,
    process_experiment,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_s3():
    return MagicMock()


@pytest.fixture
def db_session():
    """In-memory SQLite session for each test."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _make_model(db_session, openrouter_id: str, model_id: str = None) -> Model:
    """Helper: create and persist a Model."""
    model_id = model_id or openrouter_id.replace("/", "-")
    m = Model(
        model_id=model_id,
        model_name=model_id,
        provider="TestProvider",
        openrouter_id=openrouter_id,
        avatar_color="#AABBCC",
    )
    db_session.add(m)
    db_session.flush()
    return m


def _make_summary_line(game_num: int, winner: int = 2, suffix: str = "") -> str:
    """Build a single JSONL summary line for game_num with 7 players."""
    players = {}
    for i in range(1, 8):
        openrouter_id = f"testprovider/model-{i}{suffix}"
        identity = "Impostor" if i <= 2 else "Crewmate"
        players[f"Player {i}"] = {
            "model": openrouter_id,
            "identity": identity,
            "color": f"color{i}",
        }
    entry = {
        f"Game {game_num}": {
            **players,
            "winner": winner,
            "game_outcome": {"winner": "Crewmates" if winner == 2 else "Impostors"},
        }
    }
    return json.dumps(entry)


SEVEN_MODELS = [f"testprovider/model-{i}" for i in range(1, 8)]


def _seed_seven_models(db_session) -> list[Model]:
    """Seed the DB with 7 test models matching _make_summary_line defaults."""
    models = []
    for i in range(1, 8):
        m = _make_model(db_session, f"testprovider/model-{i}", f"model-id-{i}")
        models.append(m)
    db_session.commit()
    return models


# ---------------------------------------------------------------------------
# parse_summary_jsonl
# ---------------------------------------------------------------------------


class TestParseSummaryJsonl:
    def test_single_game(self):
        line = _make_summary_line(1, winner=2)
        result = parse_summary_jsonl(line)
        assert "Game 1" in result
        game = result["Game 1"]
        assert game["winner"] == 2
        assert "Player 1" in game
        assert game["Player 7"]["model"] == "testprovider/model-7"

    def test_multiple_games(self):
        text = "\n".join([_make_summary_line(1, winner=2), _make_summary_line(2, winner=1)])
        result = parse_summary_jsonl(text)
        assert "Game 1" in result
        assert "Game 2" in result
        assert result["Game 1"]["winner"] == 2
        assert result["Game 2"]["winner"] == 1

    def test_skips_blank_lines(self):
        text = f"\n\n{_make_summary_line(1)}\n\n"
        result = parse_summary_jsonl(text)
        assert len(result) == 1

    def test_raises_on_invalid_json(self):
        with pytest.raises(json.JSONDecodeError):
            parse_summary_jsonl("not json")


# ---------------------------------------------------------------------------
# parse_agent_logs_jsonl
# ---------------------------------------------------------------------------


class TestParseAgentLogsJsonl:
    def test_parses_entries(self):
        entries = [
            {"game_index": 1, "step": 1, "player": "Red", "action": "move"},
            {"game_index": 1, "step": 2, "player": "Blue", "action": "vote"},
        ]
        text = "\n".join(json.dumps(e) for e in entries)
        result = parse_agent_logs_jsonl(text)
        assert len(result) == 2
        assert result[0]["player"] == "Red"

    def test_skips_blank_lines(self):
        text = f'\n{json.dumps({"step": 1})}\n\n{json.dumps({"step": 2})}\n'
        result = parse_agent_logs_jsonl(text)
        assert len(result) == 2


# ---------------------------------------------------------------------------
# parse_agent_logs_json (HumanAgent legacy format)
# ---------------------------------------------------------------------------

_HUMAN_ENTRY_1 = {
    "game_index": "Game 1",
    "step": 0,
    "timestamp": "2026-04-06 18:20:54.000000",
    "player": {
        "name": "Player 7: cyan",
        "identity": "Crewmate",
        "personality": None,
        "model": "homosapiens/brain-1.0",
        "location": "Cafeteria",
    },
    "interaction": {
        "system_prompt": "Human Agent (Web)",
        "response": {
            "Condensed Memory": "Just started.",
            "Thinking Process": "I'll move to Admin.",
            "Action": "MOVE from Cafeteria to Admin",
        },
    },
}

_HUMAN_ENTRY_2 = {
    "game_index": "Game 1",
    "step": 1,
    "timestamp": "2026-04-06 18:21:10.000000",
    "player": {
        "name": "Player 7: cyan",
        "identity": "Crewmate",
        "personality": None,
        "model": "homosapiens/brain-1.0",
        "location": "Admin",
    },
    "interaction": {
        "system_prompt": "Human Agent (Web)",
        "response": {
            "Condensed Memory": "Moved to Admin.",
            "Thinking Process": "Complete a task.",
            "Action": "COMPLETE TASK - Swipe Card",
        },
    },
}


def _make_agent_logs_json(*entries) -> str:
    """Produce concatenated pretty-printed JSON objects (HumanAgent format)."""
    return "\n".join(json.dumps(e, indent=2) for e in entries)


class TestParseAgentLogsJson:
    def test_parses_single_entry(self):
        text = _make_agent_logs_json(_HUMAN_ENTRY_1)
        result = parse_agent_logs_json(text)
        assert len(result) == 1
        assert result[0]["player"]["model"] == "homosapiens/brain-1.0"
        assert result[0]["step"] == 0

    def test_parses_multiple_entries(self):
        text = _make_agent_logs_json(_HUMAN_ENTRY_1, _HUMAN_ENTRY_2)
        result = parse_agent_logs_json(text)
        assert len(result) == 2
        assert result[0]["step"] == 0
        assert result[1]["step"] == 1

    def test_empty_string_returns_empty_list(self):
        assert parse_agent_logs_json("") == []

    def test_whitespace_only_returns_empty_list(self):
        assert parse_agent_logs_json("   \n\n   ") == []

    def test_preserves_nested_structure(self):
        text = _make_agent_logs_json(_HUMAN_ENTRY_1)
        result = parse_agent_logs_json(text)
        assert result[0]["interaction"]["response"]["Action"] == "MOVE from Cafeteria to Admin"
        assert result[0]["player"]["location"] == "Cafeteria"


# ---------------------------------------------------------------------------
# _log_entry_key normalization
# ---------------------------------------------------------------------------


class TestLogEntryKey:
    def test_int_game_index(self):
        entry = {"game_index": 1, "step": 0, "player": {"name": "Player 1: pink"}}
        gi, step, name = _log_entry_key(entry)
        assert gi == 1
        assert step == 0
        assert name == "Player 1: pink"

    def test_string_game_index(self):
        entry = {"game_index": "Game 1", "step": 0, "player": {"name": "Player 7: cyan"}}
        gi, step, name = _log_entry_key(entry)
        assert gi == 1

    def test_int_and_string_match(self):
        flat = {"game_index": 1, "step": 2, "player": {"name": "Player 7: cyan"}}
        nested = {"game_index": "Game 1", "step": 2, "player": {"name": "Player 7: cyan"}}
        assert _log_entry_key(flat) == _log_entry_key(nested)


# ---------------------------------------------------------------------------
# process_experiment merges human entries from agent-logs.json
# ---------------------------------------------------------------------------


class TestProcessExperimentMergesHumanLogs:
    def test_human_entries_included_in_uploaded_log(self, db_session, mock_s3):
        """agent-logs.json human entries should appear in the uploaded combined log."""
        _seed_seven_models(db_session)

        # Build a summary with Player 7 as the human
        players = {}
        for i in range(1, 7):
            players[f"Player {i}"] = {
                "model": f"testprovider/model-{i}",
                "identity": "Impostor" if i <= 2 else "Crewmate",
                "color": f"color{i}",
            }
        players["Player 7"] = {
            "model": HUMAN_OPENROUTER_ID,
            "identity": "Crewmate",
            "color": "cyan",
        }
        summary_line = json.dumps({"Game 1": {**players, "winner": 2, "game_outcome": {"winner": "Crewmates"}}})
        human_logs_text = _make_agent_logs_json(_HUMAN_ENTRY_1, _HUMAN_ENTRY_2)

        uploaded_body = None

        def get_object(Bucket, Key):
            if Key.endswith("summary.json"):
                return {"Body": type("B", (), {"read": lambda s: summary_line.encode()})()}
            if Key.endswith("agent-logs.jsonl"):
                return {"Body": type("B", (), {"read": lambda s: b""})()}
            if Key.endswith("agent-logs.json"):
                return {"Body": type("B", (), {"read": lambda s: human_logs_text.encode()})()}
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")

        def put_object(Bucket, Key, Body, **kwargs):
            nonlocal uploaded_body
            uploaded_body = Body

        mock_s3.get_object.side_effect = get_object
        mock_s3.put_object.side_effect = put_object
        mock_s3.head_bucket.return_value = {}

        with patch("app.services.storage_service.get_settings") as mock_settings:
            mock_settings.return_value.s3_bucket_name = "test-bucket"
            counts = process_experiment(db_session, mock_s3, "game_1_test")

        assert counts["imported"] == 1
        assert uploaded_body is not None
        uploaded = json.loads(uploaded_body)
        agent_logs = uploaded["agent_logs"]
        human_in_logs = [
            e for e in agent_logs
            if e.get("player", {}).get("model") == HUMAN_OPENROUTER_ID
        ]
        assert len(human_in_logs) == 2

    def test_no_duplicate_when_entry_in_both_files(self, db_session, mock_s3):
        """Entries in both .jsonl and .json should only appear once."""
        _seed_seven_models(db_session)

        # A flat .jsonl entry that matches one of the human .json entries after transform
        flat_entry = {
            "game_index": 1,
            "step": 0,
            "timestamp": "2026-04-06 18:20:54.000000",
            "player": "Player 7: cyan",
            "identity": "Crewmate",
            "model": HUMAN_OPENROUTER_ID,
            "action": "MOVE from Cafeteria to Admin",
            "thinking": "",
        }
        jsonl_text = json.dumps(flat_entry)
        human_logs_text = _make_agent_logs_json(_HUMAN_ENTRY_1)

        players = {}
        for i in range(1, 7):
            players[f"Player {i}"] = {
                "model": f"testprovider/model-{i}",
                "identity": "Impostor" if i <= 2 else "Crewmate",
                "color": f"color{i}",
            }
        players["Player 7"] = {
            "model": HUMAN_OPENROUTER_ID,
            "identity": "Crewmate",
            "color": "cyan",
        }
        summary_line = json.dumps({"Game 1": {**players, "winner": 2, "game_outcome": {"winner": "Crewmates"}}})

        uploaded_body = None

        def get_object(Bucket, Key):
            if Key.endswith("summary.json"):
                return {"Body": type("B", (), {"read": lambda s: summary_line.encode()})()}
            if Key.endswith("agent-logs.jsonl"):
                return {"Body": type("B", (), {"read": lambda s: jsonl_text.encode()})()}
            if Key.endswith("agent-logs.json"):
                return {"Body": type("B", (), {"read": lambda s: human_logs_text.encode()})()}
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")

        def put_object(Bucket, Key, Body, **kwargs):
            nonlocal uploaded_body
            uploaded_body = Body

        mock_s3.get_object.side_effect = get_object
        mock_s3.put_object.side_effect = put_object
        mock_s3.head_bucket.return_value = {}

        with patch("app.services.storage_service.get_settings") as mock_settings:
            mock_settings.return_value.s3_bucket_name = "test-bucket"
            process_experiment(db_session, mock_s3, "game_1_test")

        assert uploaded_body is not None
        uploaded = json.loads(uploaded_body)
        step0_entries = [
            e for e in uploaded["agent_logs"]
            if e.get("step") == 0 and e.get("player", {}).get("name", "").startswith("Player 7")
        ]
        assert len(step0_entries) == 1


# ---------------------------------------------------------------------------
# get_model_by_openrouter_id (suffix tolerance)
# ---------------------------------------------------------------------------


class TestGetModelByOpenrouterId:
    def test_exact_match(self, db_session):
        _make_model(db_session, "google/gemini-flash")
        result = get_model_by_openrouter_id(db_session, "google/gemini-flash")
        assert result is not None
        assert result.openrouter_id == "google/gemini-flash"

    def test_strips_free_suffix(self, db_session):
        _make_model(db_session, "google/gemini-flash")
        result = get_model_by_openrouter_id(db_session, "google/gemini-flash:free")
        assert result is not None
        assert result.openrouter_id == "google/gemini-flash"

    def test_strips_extended_suffix(self, db_session):
        _make_model(db_session, "anthropic/claude-opus-4")
        result = get_model_by_openrouter_id(db_session, "anthropic/claude-opus-4:extended")
        assert result is not None

    def test_returns_none_for_unknown(self, db_session):
        result = get_model_by_openrouter_id(db_session, "does/not-exist")
        assert result is None

    def test_appends_free_suffix(self, db_session):
        """Log has bare ID, DB has :free — the real nemotron scenario."""
        _make_model(db_session, "nvidia/nemotron-3-super-120b-a12b:free")
        result = get_model_by_openrouter_id(db_session, "nvidia/nemotron-3-super-120b-a12b")
        assert result is not None
        assert result.openrouter_id == "nvidia/nemotron-3-super-120b-a12b:free"

    def test_appends_extended_suffix(self, db_session):
        _make_model(db_session, "anthropic/claude-opus-4:extended")
        result = get_model_by_openrouter_id(db_session, "anthropic/claude-opus-4")
        assert result is not None

    def test_exact_match_preferred_over_suffix_strip(self, db_session):
        _make_model(db_session, "google/gemini-flash:free", "model-free")
        _make_model(db_session, "google/gemini-flash", "model-base")
        # Exact match should win
        result = get_model_by_openrouter_id(db_session, "google/gemini-flash:free")
        assert result.model_id == "model-free"


# ---------------------------------------------------------------------------
# ensure_human_model
# ---------------------------------------------------------------------------


class TestEnsureHumanModel:
    def test_creates_model_if_missing(self, db_session):
        model = ensure_human_model(db_session)
        assert model is not None
        assert model.openrouter_id == HUMAN_OPENROUTER_ID
        assert model.model_id == HUMAN_MODEL_ID
        assert model.model_name == HUMAN_MODEL_NAME
        assert model.provider == HUMAN_PROVIDER
        assert model.avatar_color == HUMAN_AVATAR_COLOR

    def test_idempotent(self, db_session):
        m1 = ensure_human_model(db_session)
        db_session.commit()
        m2 = ensure_human_model(db_session)
        assert m1.id == m2.id

    def test_creates_rating_record(self, db_session):
        model = ensure_human_model(db_session)
        db_session.commit()
        rating = db_session.query(ModelRating).filter_by(model_id=model.id).first()
        assert rating is not None


# ---------------------------------------------------------------------------
# create_game_from_summary
# ---------------------------------------------------------------------------


class TestCreateGameFromSummary:
    def test_creates_game_and_participants(self, db_session):
        _seed_seven_models(db_session)
        line = _make_summary_line(1, winner=2)
        summary = parse_summary_jsonl(line)["Game 1"]

        game = create_game_from_summary(db_session, "test-game-1", summary)

        assert game.id == "test-game-1"
        assert game.status == GameStatus.COMPLETED
        assert game.winner == 2
        assert game.engine_version == 1
        assert len(game.model_ids) == 7

        db_session.commit()
        participants = db_session.query(GameParticipant).filter_by(game_id=game.id).all()
        assert len(participants) == 7

    def test_player_roles_and_won_flags(self, db_session):
        _seed_seven_models(db_session)
        # winner=2 means crewmates win
        line = _make_summary_line(1, winner=2)
        summary = parse_summary_jsonl(line)["Game 1"]

        game = create_game_from_summary(db_session, "test-game-2", summary)
        db_session.commit()

        participants = (
            db_session.query(GameParticipant)
            .filter_by(game_id=game.id)
            .order_by(GameParticipant.player_number)
            .all()
        )
        # Players 1-2 are Impostors, 3-7 are Crewmates; winner=2 => crewmates win
        for p in participants:
            if p.player_number <= 2:
                assert p.role == PlayerRole.IMPOSTOR
                assert p.won is False
            else:
                assert p.role == PlayerRole.CREWMATE
                assert p.won is True

    def test_auto_registers_human_model(self, db_session):
        # Seed 6 normal models; Player 7 will be the human
        for i in range(1, 7):
            _make_model(db_session, f"testprovider/model-{i}", f"model-id-{i}")
        db_session.commit()

        # Build a summary where Player 7 is homosapiens/brain-1.0
        players = {}
        for i in range(1, 7):
            players[f"Player {i}"] = {
                "model": f"testprovider/model-{i}",
                "identity": "Impostor" if i <= 2 else "Crewmate",
                "color": f"color{i}",
            }
        players["Player 7"] = {
            "model": HUMAN_OPENROUTER_ID,
            "identity": "Crewmate",
            "color": "cyan",
        }
        game_summary = {**players, "winner": 2}

        game = create_game_from_summary(db_session, "test-human-game", game_summary)
        db_session.commit()

        human_model = db_session.query(Model).filter_by(openrouter_id=HUMAN_OPENROUTER_ID).first()
        assert human_model is not None

        p7 = (
            db_session.query(GameParticipant)
            .filter_by(game_id=game.id, player_number=7)
            .first()
        )
        assert p7 is not None
        assert p7.model_id == human_model.id

    def test_raises_on_unknown_model(self, db_session):
        _seed_seven_models(db_session)
        line = _make_summary_line(1, suffix=":unknown-suffix")
        summary = parse_summary_jsonl(line)["Game 1"]
        # :unknown-suffix is not stripped, so models won't be found
        with pytest.raises(ValueError, match="Unknown model"):
            create_game_from_summary(db_session, "bad-game", summary)

    def test_raises_on_missing_player(self, db_session):
        _seed_seven_models(db_session)
        summary = {"winner": 2}  # No Player entries at all
        with pytest.raises(ValueError, match="Missing Player"):
            create_game_from_summary(db_session, "missing-player-game", summary)


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------


class TestIdempotency:
    def test_second_import_skips_existing_game(self, db_session, mock_s3):
        _seed_seven_models(db_session)

        summary_line = _make_summary_line(1, winner=2)
        logs_text = ""

        def get_object(Bucket, Key):
            if Key.endswith("summary.json"):
                return {"Body": MagicMock(read=lambda: summary_line.encode())}
            if Key.endswith("agent-logs.jsonl"):
                return {"Body": MagicMock(read=lambda: logs_text.encode())}
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")

        mock_s3.get_object.side_effect = get_object
        mock_s3.get_paginator.return_value.paginate.return_value = [
            {"CommonPrefixes": [{"Prefix": "game_1_test/"}]}
        ]
        mock_s3.put_object.return_value = {}
        mock_s3.head_bucket.return_value = {}

        with patch("app.services.storage_service.get_settings") as mock_settings:
            mock_settings.return_value.s3_bucket_name = "test-bucket"

            # First import
            counts1 = process_experiment(db_session, mock_s3, "game_1_test")
            # Second import
            counts2 = process_experiment(db_session, mock_s3, "game_1_test")

        assert counts1["imported"] == 1
        assert counts2["skipped"] == 1
        assert counts2["imported"] == 0


# ---------------------------------------------------------------------------
# Dry run
# ---------------------------------------------------------------------------


class TestDryRun:
    def test_dry_run_does_not_create_game(self, db_session, mock_s3):
        _seed_seven_models(db_session)

        summary_line = _make_summary_line(1, winner=2)

        def get_object(Bucket, Key):
            if Key.endswith("summary.json"):
                return {"Body": MagicMock(read=lambda: summary_line.encode())}
            if Key.endswith("agent-logs.jsonl"):
                return {"Body": MagicMock(read=lambda: b"")}
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")

        mock_s3.get_object.side_effect = get_object

        with patch("app.services.storage_service.get_settings") as mock_settings:
            mock_settings.return_value.s3_bucket_name = "test-bucket"

            counts = process_experiment(db_session, mock_s3, "game_1_test", dry_run=True)

        # Dry run reports "imported" (what would be) but doesn't write to DB
        assert counts["imported"] == 1
        game_count = db_session.query(Game).count()
        assert game_count == 0
        mock_s3.put_object.assert_not_called()

    def test_dry_run_does_not_call_upload_game_logs(self, db_session, mock_s3):
        _seed_seven_models(db_session)

        summary_line = _make_summary_line(1, winner=2)

        def get_object(Bucket, Key):
            if Key.endswith("summary.json"):
                return {"Body": MagicMock(read=lambda: summary_line.encode())}
            if Key.endswith("agent-logs.jsonl"):
                return {"Body": MagicMock(read=lambda: b"")}
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")

        mock_s3.get_object.side_effect = get_object

        with patch("scripts.sync_bucket_logs.upload_game_logs") as mock_upload, patch(
            "app.services.storage_service.get_settings"
        ) as mock_settings:
            mock_settings.return_value.s3_bucket_name = "test-bucket"
            process_experiment(db_session, mock_s3, "game_1_test", dry_run=True)

        mock_upload.assert_not_called()


# ---------------------------------------------------------------------------
# Multi-game experiment
# ---------------------------------------------------------------------------


class TestMultiGameExperiment:
    def test_multiple_games_get_suffixed_ids(self, db_session, mock_s3):
        _seed_seven_models(db_session)

        # Two games in one summary
        summary_text = "\n".join(
            [_make_summary_line(1, winner=2), _make_summary_line(2, winner=1)]
        )

        def get_object(Bucket, Key):
            if Key.endswith("summary.json"):
                return {"Body": MagicMock(read=lambda: summary_text.encode())}
            if Key.endswith("agent-logs.jsonl"):
                return {"Body": MagicMock(read=lambda: b"")}
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")

        mock_s3.get_object.side_effect = get_object
        mock_s3.put_object.return_value = {}
        mock_s3.head_bucket.return_value = {}

        with patch("app.services.storage_service.get_settings") as mock_settings:
            mock_settings.return_value.s3_bucket_name = "test-bucket"

            counts = process_experiment(db_session, mock_s3, "game_multi_test")

        assert counts["imported"] == 2
        assert counts["failed"] == 0

        g1 = db_session.query(Game).filter_by(id="game_multi_test_g1").first()
        g2 = db_session.query(Game).filter_by(id="game_multi_test_g2").first()
        assert g1 is not None
        assert g2 is not None

    def test_single_game_uses_directory_name(self, db_session, mock_s3):
        _seed_seven_models(db_session)

        summary_text = _make_summary_line(1, winner=2)

        def get_object(Bucket, Key):
            if Key.endswith("summary.json"):
                return {"Body": MagicMock(read=lambda: summary_text.encode())}
            if Key.endswith("agent-logs.jsonl"):
                return {"Body": MagicMock(read=lambda: b"")}
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")

        mock_s3.get_object.side_effect = get_object
        mock_s3.put_object.return_value = {}
        mock_s3.head_bucket.return_value = {}

        with patch("app.services.storage_service.get_settings") as mock_settings:
            mock_settings.return_value.s3_bucket_name = "test-bucket"

            counts = process_experiment(db_session, mock_s3, "game_1_2026-04-06_18-19-19")

        assert counts["imported"] == 1
        game = db_session.query(Game).filter_by(id="game_1_2026-04-06_18-19-19").first()
        assert game is not None


# ---------------------------------------------------------------------------
# download_text
# ---------------------------------------------------------------------------


class TestDownloadText:
    def test_returns_text_on_success(self, mock_s3):
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=lambda: b"hello world")
        }
        result = download_text(mock_s3, "some/key")
        assert result == "hello world"

    def test_returns_none_on_nosuchkey(self, mock_s3):
        mock_s3.get_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey"}}, "GetObject"
        )
        result = download_text(mock_s3, "missing/key")
        assert result is None

    def test_returns_none_on_404_code(self, mock_s3):
        mock_s3.get_object.side_effect = ClientError(
            {"Error": {"Code": "404"}}, "GetObject"
        )
        result = download_text(mock_s3, "missing/key")
        assert result is None

    def test_raises_on_other_error(self, mock_s3):
        mock_s3.get_object.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied"}}, "GetObject"
        )
        with pytest.raises(ClientError):
            download_text(mock_s3, "forbidden/key")
