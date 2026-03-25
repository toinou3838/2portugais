from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.vocabulary_entry import VocabularyEntry
from app.schemas.quiz import QuizGenerateIn, QuizGenerateOut, QuizItemOut

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@lru_cache(maxsize=1)
def load_conjugation_entries() -> list[dict[str, str | int]]:
    with (DATA_DIR / "conjugations.json").open("r", encoding="utf-8") as file:
        return json.load(file)


@lru_cache(maxsize=1)
def load_seed_vocabulary_entries() -> list[dict[str, str | int]]:
    with (DATA_DIR / "base_vocabulary.json").open("r", encoding="utf-8") as file:
        return json.load(file)


def ensure_default_vocabulary(db: Session) -> None:
    existing = db.scalar(select(func.count(VocabularyEntry.id)))
    if existing and existing > 0:
        return

    for item in load_seed_vocabulary_entries():
        db.add(
            VocabularyEntry(
                fr=str(item["fr"]),
                pt=str(item["pt"]),
                dir=int(item["dir"]),
                source="vocab",
                created_by_user_id=None,
            )
        )
    db.commit()


def _sample(pool: list[dict[str, str | int]], count: int) -> list[dict[str, str | int]]:
    if count <= 0:
        return []
    if count >= len(pool):
        return pool.copy()
    return random.sample(pool, count)


def generate_quiz(db: Session, payload: QuizGenerateIn) -> QuizGenerateOut:
    ensure_default_vocabulary(db)

    vocab_entries = db.scalars(select(VocabularyEntry).order_by(VocabularyEntry.id)).all()
    vocab_pool = [
        {
            "id": f"vocab-{entry.id}",
            "fr": entry.fr,
            "pt": entry.pt,
            "dir": entry.dir,
            "source": "vocab",
        }
        for entry in vocab_entries
    ]
    conjugation_pool = load_conjugation_entries()

    requested = payload.question_count
    desired_conjugation = round(requested * payload.conjugation_percentage / 100)
    desired_vocab = requested - desired_conjugation

    conjugation_count = min(desired_conjugation, len(conjugation_pool))
    vocab_count = min(desired_vocab, len(vocab_pool))

    remaining = requested - conjugation_count - vocab_count
    if remaining > 0:
        extra_vocab_capacity = max(0, len(vocab_pool) - vocab_count)
        extra_vocab = min(remaining, extra_vocab_capacity)
        vocab_count += extra_vocab
        remaining -= extra_vocab

    if remaining > 0:
        extra_conjugation_capacity = max(0, len(conjugation_pool) - conjugation_count)
        extra_conjugation = min(remaining, extra_conjugation_capacity)
        conjugation_count += extra_conjugation
        remaining -= extra_conjugation

    chosen_vocab = _sample(vocab_pool, vocab_count)
    chosen_conjugation = _sample(conjugation_pool, conjugation_count)

    items = [*chosen_vocab, *chosen_conjugation]
    random.shuffle(items)

    quiz_items = [QuizItemOut(**item) for item in items]

    return QuizGenerateOut(
        quiz_id=str(uuid4()),
        generated_at=datetime.now(timezone.utc),
        requested_question_count=requested,
        actual_question_count=len(quiz_items),
        source_breakdown={
            "vocab": len(chosen_vocab),
            "conjugaison": len(chosen_conjugation),
        },
        items=quiz_items,
    )
