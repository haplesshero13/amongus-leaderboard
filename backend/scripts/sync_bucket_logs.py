#!/usr/bin/env python3
"""
Sync game logs from R2 bucket prefixes (game_*/) into the leaderboard database.

These are human-AI experiment outputs uploaded externally (e.g., from AmongLLMs
experiments with homosapiens/brain-1.0 players). The script reads summary.json
(JSONL format) and agent-logs.jsonl from each prefix, creates Game/GameParticipant
records, transforms and re-uploads logs, and updates ratings.

Usage:
    # Sync all game_* prefixes from R2
    python -m scripts.sync_bucket_logs

    # Dry run (show what would be imported)
    python -m scripts.sync_bucket_logs --dry-run

    # Skip rating updates
    python -m scripts.sync_bucket_logs --skip-ratings

    # Only process a specific experiment prefix
    python -m scripts.sync_bucket_logs --prefix game_1_2026-04-06_18-19-19
"""

import argparse
import json
import sys
from datetime import datetime, timezone

from botocore.exceptions import ClientError

from app.core.constants import CURRENT_ENGINE_VERSION
from app.core.database import SessionLocal
from app.models import Game, GameParticipant, GameStatus, Model, ModelRating, PlayerRole
from app.services.game_runner import _transform_long_context_log
from app.services.rating_service import update_ratings_for_game
from app.services.storage_service import get_s3_client, upload_game_logs

# The R2 bucket that contains raw experiment output (game_*/ prefixes)
EXPERIMENT_BUCKET = "amongus-leaderboard"

# Human player model constants for auto-registration
HUMAN_OPENROUTER_ID = "homosapiens/brain-1.0"
HUMAN_PROVIDER = "Humanity"
HUMAN_MODEL_NAME = "Human Brain 1.0"
HUMAN_MODEL_ID = "brain-1.0"
HUMAN_AVATAR_COLOR = "#743D2B"

# Suffixes to strip for tolerant model lookup
OPENROUTER_SUFFIXES = (":free", ":extended")


# ---------------------------------------------------------------------------
# R2 helpers
# ---------------------------------------------------------------------------


def list_experiment_prefixes(s3_client) -> list[str]:
    """List top-level game_*/ prefixes in the experiment bucket."""
    paginator = s3_client.get_paginator("list_objects_v2")
    prefixes = []
    for page in paginator.paginate(Bucket=EXPERIMENT_BUCKET, Prefix="game_", Delimiter="/"):
        for cp in page.get("CommonPrefixes", []):
            prefix = cp["Prefix"]  # e.g. "game_1_2026-04-06_18-19-19/"
            prefixes.append(prefix.rstrip("/"))
    return sorted(prefixes)


def download_text(s3_client, key: str) -> str | None:
    """Download an object from the experiment bucket as text.

    Returns None if the object does not exist.
    """
    try:
        resp = s3_client.get_object(Bucket=EXPERIMENT_BUCKET, Key=key)
        return resp["Body"].read().decode("utf-8")
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404"):
            return None
        raise


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def parse_summary_jsonl(text: str) -> dict[str, dict]:
    """Parse JSONL summary into {game_key: game_data} dict.

    Each line is a JSON object like {"Game 1": {...}}.
    Returns a merged dict of all game keys.
    """
    result: dict = {}
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        result.update(obj)
    return result


def parse_agent_logs_jsonl(text: str) -> list[dict]:
    """Parse agent-logs.jsonl into a list of raw log entries (not yet transformed)."""
    logs = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            logs.append(json.loads(line))
    return logs


def parse_agent_logs_json(text: str) -> list[dict]:
    """Parse agent-logs.json (concatenated pretty-printed JSON objects) into entries.

    HumanAgent writes one JSON object per turn appended to the file without
    wrapping them in an array. Entries are already in the frontend-expected
    nested format; no _transform_long_context_log needed.
    """
    decoder = json.JSONDecoder()
    entries = []
    idx = 0
    while idx < len(text):
        text_slice = text[idx:].lstrip()
        if not text_slice:
            break
        skip = len(text[idx:]) - len(text_slice)
        obj, end = decoder.raw_decode(text_slice)
        entries.append(obj)
        idx += skip + end
    return entries


def _log_entry_key(entry: dict) -> tuple:
    """Return a deduplication key for a log entry.

    game_index may be int (from .jsonl after transform) or 'Game N' string
    (from .json). Normalize to int for comparison.
    """
    raw_gi = entry.get("game_index")
    if isinstance(raw_gi, str) and raw_gi.startswith("Game "):
        try:
            gi = int(raw_gi.split(" ")[1])
        except (IndexError, ValueError):
            gi = raw_gi
    else:
        gi = raw_gi
    player_raw = entry.get("player", {})
    if isinstance(player_raw, dict):
        player_name = player_raw.get("name", "")
    else:
        player_name = str(player_raw)
    step = entry.get("step")
    return (gi, step, player_name)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def ensure_human_model(db) -> Model:
    """Auto-register the human model if not already in the DB. Returns the model."""
    model = db.query(Model).filter(Model.openrouter_id == HUMAN_OPENROUTER_ID).first()
    if model:
        return model

    print(f"  Auto-registering human model: {HUMAN_OPENROUTER_ID}")
    model = Model(
        model_id=HUMAN_MODEL_ID,
        model_name=HUMAN_MODEL_NAME,
        provider=HUMAN_PROVIDER,
        openrouter_id=HUMAN_OPENROUTER_ID,
        avatar_color=HUMAN_AVATAR_COLOR,
    )
    db.add(model)
    db.flush()
    # Create a default rating record so rating calculations work immediately
    rating = ModelRating(model_id=model.id)
    db.add(rating)
    db.flush()
    return model


def get_model_by_openrouter_id(db, openrouter_id: str) -> Model | None:
    """Look up a model by openrouter_id with suffix tolerance.

    Tries exact match first, then strips known suffixes (:free, :extended).
    """
    # Exact match
    model = db.query(Model).filter(Model.openrouter_id == openrouter_id).first()
    if model:
        return model

    # Strip suffixes from the lookup ID (log has :free, DB has bare)
    for suffix in OPENROUTER_SUFFIXES:
        if openrouter_id.endswith(suffix):
            stripped = openrouter_id[: -len(suffix)]
            model = db.query(Model).filter(Model.openrouter_id == stripped).first()
            if model:
                return model
            break

    # Append suffixes to the lookup ID (log has bare, DB has :free)
    for suffix in OPENROUTER_SUFFIXES:
        if not openrouter_id.endswith(suffix):
            model = db.query(Model).filter(Model.openrouter_id == openrouter_id + suffix).first()
            if model:
                return model

    return None


def create_game_from_summary(
    db,
    game_id: str,
    game_summary: dict,
) -> Game:
    """Create a Game record and its GameParticipant records.

    The human model is auto-registered if encountered.
    All other models must already exist in the database.

    Args:
        db: Database session.
        game_id: Unique identifier for this game.
        game_summary: Single game dict from summary.json (Player 1..7, winner, etc.).

    Returns:
        The created (unflushed-commit) Game record.

    Raises:
        ValueError: If a model is not found or data is invalid.
    """
    winner = game_summary.get("winner")

    winner_reason = ""
    game_outcome = game_summary.get("game_outcome", {})
    if isinstance(game_outcome, dict):
        winner_reason = game_outcome.get("winner", "")

    game = Game(
        id=game_id,
        status=GameStatus.COMPLETED,
        winner=winner,
        winner_reason=winner_reason,
        engine_version=CURRENT_ENGINE_VERSION,
        started_at=datetime.now(timezone.utc),
        ended_at=datetime.now(timezone.utc),
    )
    db.add(game)
    db.flush()

    impostors_won = winner in (1, 4)

    model_ids = []
    for i in range(1, 8):
        player_key = f"Player {i}"
        player_data = game_summary.get(player_key)
        if not player_data:
            raise ValueError(f"Missing {player_key} in game summary")

        openrouter_id = player_data.get("model")
        if not openrouter_id:
            raise ValueError(f"Missing 'model' for {player_key}")

        # Auto-register the human model; look up all others in the DB
        if openrouter_id == HUMAN_OPENROUTER_ID:
            model = ensure_human_model(db)
        else:
            model = get_model_by_openrouter_id(db, openrouter_id)
            if not model:
                raise ValueError(
                    f"Unknown model '{openrouter_id}' for {player_key}. "
                    f"Register this model in the database first."
                )

        model_ids.append(model.id)

        identity = player_data.get("identity")
        if identity not in ("Impostor", "Crewmate"):
            raise ValueError(f"Invalid identity '{identity}' for {player_key}")
        role = PlayerRole.IMPOSTOR if identity == "Impostor" else PlayerRole.CREWMATE

        color = player_data.get("color")
        if not color:
            raise ValueError(f"Missing 'color' for {player_key}")
        player_won = (role == PlayerRole.IMPOSTOR) == impostors_won

        participant = GameParticipant(
            game_id=game.id,
            model_id=model.id,
            player_number=i,
            player_color=color,
            role=role,
            won=player_won,
        )
        db.add(participant)

    game.model_ids = model_ids
    db.flush()
    return game


# ---------------------------------------------------------------------------
# Experiment processing
# ---------------------------------------------------------------------------


def process_experiment(
    db,
    s3_client,
    experiment_name: str,
    dry_run: bool = False,
    skip_ratings: bool = False,
) -> dict:
    """Process a single experiment prefix from R2.

    Returns dict with counts: {"imported": N, "skipped": N, "failed": N, "errors": [...]}.
    """
    result: dict = {"imported": 0, "skipped": 0, "failed": 0, "errors": []}

    # --- Download summary.json ---
    summary_text = download_text(s3_client, f"{experiment_name}/summary.json")
    if not summary_text:
        print(f"  SKIP: {experiment_name}: summary.json not found (game likely incomplete)")
        result["skipped"] += 1
        return result

    try:
        all_games = parse_summary_jsonl(summary_text)
    except json.JSONDecodeError as e:
        msg = f"{experiment_name}: Failed to parse summary.json: {e}"
        print(f"  ERROR: {msg}")
        result["failed"] += 1
        result["errors"].append(msg)
        return result

    # --- Download agent-logs.jsonl (LongContextAgent / AI entries) ---
    logs_text = download_text(s3_client, f"{experiment_name}/agent-logs.jsonl")
    if logs_text:
        try:
            raw_logs = parse_agent_logs_jsonl(logs_text)
        except json.JSONDecodeError as e:
            msg = f"{experiment_name}: Failed to parse agent-logs.jsonl: {e}"
            print(f"  ERROR: {msg}")
            result["failed"] += 1
            result["errors"].append(msg)
            return result
    else:
        raw_logs = []

    # --- Download agent-logs.json (HumanAgent / legacy entries) and merge ---
    human_logs_text = download_text(s3_client, f"{experiment_name}/agent-logs.json")
    if human_logs_text:
        try:
            human_logs = parse_agent_logs_json(human_logs_text)
            # Deduplicate: skip any entry already present from .jsonl
            existing_keys = {_log_entry_key(_transform_long_context_log(e)) for e in raw_logs}
            for entry in human_logs:
                if _log_entry_key(entry) not in existing_keys:
                    raw_logs.append(entry)
        except (json.JSONDecodeError, ValueError) as e:
            msg = f"{experiment_name}: Failed to parse agent-logs.json: {e}"
            print(f"  ERROR: {msg}")
            result["failed"] += 1
            result["errors"].append(msg)
            return result

    # --- Enumerate games ---
    game_keys = sorted(
        [k for k in all_games if k.startswith("Game ")],
        key=lambda k: int(k.split(" ")[1]),
    )

    if not game_keys:
        msg = f"{experiment_name}: No games found in summary.json"
        print(f"  ERROR: {msg}")
        result["failed"] += 1
        result["errors"].append(msg)
        return result

    print(f"  Games: {len(game_keys)}  Raw log entries: {len(raw_logs)}")

    for game_key in game_keys:
        game_index = int(game_key.split(" ")[1])
        game_summary = all_games[game_key]

        # Build canonical game ID
        if len(game_keys) == 1:
            game_id = experiment_name
        else:
            game_id = f"{experiment_name}_g{game_index}"

        # Idempotency check
        existing = db.query(Game).filter(Game.id == game_id).first()
        if existing:
            print(f"  {game_key}: SKIP (already exists: {game_id})")
            result["skipped"] += 1
            continue

        if dry_run:
            winner = game_summary.get("winner")
            print(f"  {game_key}: Would create {game_id} (winner={winner})")
            for i in range(1, 8):
                pd = game_summary.get(f"Player {i}", {})
                print(
                    f"    Player {i}: {pd.get('model')} ({pd.get('identity')}, {pd.get('color')})"
                )
            result["imported"] += 1
            continue

        # Filter raw logs for this game_index and transform to frontend format.
        # .jsonl entries store game_index as int; .json (human) entries store it
        # as "Game N" string. Use _log_entry_key's normalization to match both.
        # .json entries are already in nested format; only transform .jsonl entries.
        game_logs = []
        for entry in raw_logs:
            gi, _, _ = _log_entry_key(entry)
            if gi != game_index:
                continue
            # Distinguish format: .json entries have nested player dict with
            # 'identity' key; .jsonl (flat) entries have top-level 'identity'.
            if isinstance(entry.get("player"), dict):
                game_logs.append(entry)  # already nested — no transform needed
            else:
                game_logs.append(_transform_long_context_log(entry))

        try:
            print(f"  {game_key}: Creating {game_id}...", end=" ", flush=True)

            game = create_game_from_summary(db, game_id, game_summary)

            # Upload combined logs to R2
            bucket, key = upload_game_logs(game.id, game_summary, game_logs, client=s3_client)
            game.log_bucket = bucket
            game.log_key = key
            db.flush()

            if not skip_ratings:
                update_ratings_for_game(db, game)

            db.commit()
            print("OK")
            result["imported"] += 1

        except ValueError as e:
            print(f"FAIL: {e}")
            db.rollback()
            result["failed"] += 1
            result["errors"].append(f"{experiment_name}/{game_key}: {e}")
        except Exception as e:
            print(f"FAIL: Unexpected error: {e}")
            db.rollback()
            result["failed"] += 1
            result["errors"].append(f"{experiment_name}/{game_key}: {type(e).__name__}: {e}")

    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Sync game logs from R2 bucket (game_* prefixes) into the leaderboard DB"
    )
    parser.add_argument(
        "--prefix",
        type=str,
        default=None,
        help="Only process the experiment with this exact name (e.g. game_1_2026-04-06_18-19-19)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be imported without making changes",
    )
    parser.add_argument(
        "--skip-ratings",
        action="store_true",
        help="Skip rating updates after import",
    )
    args = parser.parse_args()

    s3_client = get_s3_client()

    print(f"Experiment bucket: {EXPERIMENT_BUCKET}")
    print("Listing experiment prefixes (game_*/)")

    try:
        prefixes = list_experiment_prefixes(s3_client)
    except ClientError as e:
        print(f"ERROR: Could not list bucket {EXPERIMENT_BUCKET!r}: {e}")
        sys.exit(1)

    if not prefixes:
        print("No game_* prefixes found in bucket.")
        sys.exit(0)

    # Apply optional prefix filter
    if args.prefix:
        prefixes = [p for p in prefixes if p == args.prefix]
        if not prefixes:
            print(f"No experiment named {args.prefix!r} found in bucket.")
            sys.exit(0)

    print(f"Found {len(prefixes)} experiment(s): {prefixes}")

    if args.dry_run:
        print("[DRY RUN - no changes will be made]\n")

    db = SessionLocal()
    try:
        total_imported = total_skipped = total_failed = 0
        all_errors: list[str] = []

        for experiment_name in prefixes:
            print(f"\n{experiment_name}/")
            counts = process_experiment(
                db,
                s3_client,
                experiment_name,
                dry_run=args.dry_run,
                skip_ratings=args.skip_ratings,
            )
            total_imported += counts["imported"]
            total_skipped += counts["skipped"]
            total_failed += counts["failed"]
            all_errors.extend(counts["errors"])

        print(f"\n{'=' * 60}")
        print(f"Imported: {total_imported}  Skipped: {total_skipped}  Failed: {total_failed}")
        if args.dry_run:
            print("(Dry run - no actual changes made)")
        if all_errors:
            print("\nErrors:")
            for err in all_errors:
                print(f"  - {err}")
        print(f"{'=' * 60}")

    finally:
        db.close()

    if total_failed and not args.dry_run:
        sys.exit(1)


if __name__ == "__main__":
    main()
