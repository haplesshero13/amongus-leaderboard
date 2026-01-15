#!/usr/bin/env python3
"""Seed the database with initial models for local testing.

This script creates 7 test models that all use free OpenRouter endpoints.
For local development and testing purposes only.

Usage:
    cd backend
    python -m scripts.seed_models
"""

import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import date

from sqlalchemy.orm import Session

from app.core.database import get_db, init_db
from app.models import Model, ModelRating


# Free OpenRouter models we can use for testing
# We create 7 "fake" models that all map to one of these free endpoints
FREE_OPENROUTER_MODELS = [
    "openai/gpt-3.5-turbo",  # Using as fallback, cheap enough
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-2-9b-it:free",
]

# Seed models for testing - 7 models with distinct identities
# but pointing to free OpenRouter endpoints
SEED_MODELS = [
    {
        "model_id": "not-claude-opus-4",
        "model_name": "Not Claude Opus 4",
        "provider": "Not Anthropic",
        "openrouter_id": "meta-llama/llama-3.3-70b-instruct:free",
        "release_date": date(2025, 5, 15),
        "avatar_color": "#6B5B95",
    },
    {
        "model_id": "gpt-4o-mini-free",
        "model_name": "GPT-4o-mini but the free version",
        "provider": "OpenAI Before They Went Closed",
        "openrouter_id": "openai/gpt-oss-20b:free",
        "release_date": date(2025, 3, 1),
        "avatar_color": "#10A37F",
    },
    {
        "model_id": "zemini-4.5-air",
        "model_name": "Z-AI Zemini 4.5 Air",
        "provider": "Zoogle",
        "openrouter_id": "z-ai/glm-4.5-air:free",
        "release_date": date(2025, 4, 10),
        "avatar_color": "#4285F4",
    },
    {
        "model_id": "llama-3.3-70b-instruct-free",
        "model_name": "Llama 3.3 70B Instruct",
        "provider": "Meta",
        "openrouter_id": "meta-llama/llama-3.3-70b-instruct:free",
        "release_date": date(2025, 6, 1),
        "avatar_color": "#0668E1",
    },
    {
        "model_id": "openai-gpt-oss-20b-free",
        "model_name": "OpenAI GPT-OSS 20B Free",
        "provider": "OpenAI",
        "openrouter_id": "openai/gpt-oss-20b:free",
        "release_date": date(2025, 2, 20),
        "avatar_color": "#FF7000",
    },
    {
        "model_id": "deep-llama-3.3-70b-instruct",
        "model_name": "Deep Llama 3.3 70B Instruct",
        "provider": "DeepSeek",
        "openrouter_id": "meta-llama/llama-3.3-70b-instruct:free",
        "release_date": date(2025, 5, 1),
        "avatar_color": "#00D4AA",
    },
    {
        "model_id": "z-ai-glm-4.5-air-free",
        "model_name": "Z-AI GLM 4.5 Air",
        "provider": "Z-AI",
        "openrouter_id": "z-ai/glm-4.5-air:free",
        "release_date": date(2025, 4, 25),
        "avatar_color": "#FF6A00",
    },
]


def seed_models(db: Session) -> None:
    """Seed the database with initial test models."""
    print("Seeding database with test models...")

    created_count = 0
    skipped_count = 0

    for model_data in SEED_MODELS:
        # Check if model already exists
        existing = db.query(Model).filter(Model.model_id == model_data["model_id"]).first()

        if existing:
            print(f"  ⏭️  Skipping {model_data['model_id']} (already exists)")
            skipped_count += 1
            continue

        # Create the model
        model = Model(
            model_id=model_data["model_id"],
            model_name=model_data["model_name"],
            provider=model_data["provider"],
            openrouter_id=model_data["openrouter_id"],
            release_date=model_data["release_date"],
            avatar_color=model_data["avatar_color"],
        )
        db.add(model)
        db.flush()

        # Create initial rating with default values
        rating = ModelRating(model_id=model.id)
        db.add(rating)

        print(f"  ✅ Created {model_data['model_id']} ({model_data['model_name']})")
        created_count += 1

    db.commit()

    print(f"\nSeed complete: {created_count} created, {skipped_count} skipped")


def clear_models(db: Session) -> None:
    """Clear all models from the database (use with caution!)."""
    print("Clearing all models from database...")

    count = db.query(Model).count()
    db.query(ModelRating).delete()
    db.query(Model).delete()
    db.commit()

    print(f"  🗑️  Deleted {count} models")


def main():
    """Main entry point for the seed script."""
    import argparse

    parser = argparse.ArgumentParser(description="Seed the database with test models")
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing models before seeding",
    )
    parser.add_argument(
        "--clear-only",
        action="store_true",
        help="Only clear models, don't seed new ones",
    )
    args = parser.parse_args()

    # Initialize the database (creates tables if needed)
    print("Initializing database...")
    init_db()

    # Get a database session
    db = next(get_db())

    try:
        if args.clear_only:
            clear_models(db)
        else:
            if args.clear:
                clear_models(db)
            seed_models(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
