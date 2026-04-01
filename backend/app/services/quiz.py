from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.hidden_quiz_item import HiddenQuizItem
from app.models.user_quiz_mastery import UserQuizMastery
from app.models.vocabulary_entry import VocabularyEntry
from app.schemas.quiz import QuizGenerateIn, QuizGenerateOut, QuizItemOut

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
REVIEW_MASTERY_TARGET = 3
DIFFICULTY_PROFILES: dict[int, dict[int, float]] = {
    1: {1: 0.80, 2: 0.15, 3: 0.05},
    2: {1: 0.10, 2: 0.80, 3: 0.10},
    3: {1: 0.05, 2: 0.10, 3: 0.85},
}


@lru_cache(maxsize=1)
def load_conjugation_entries() -> list[dict[str, str | int]]:
    with (DATA_DIR / "conjugations.json").open("r", encoding="utf-8") as file:
        return json.load(file)


@lru_cache(maxsize=1)
def load_seed_vocabulary_entries() -> list[dict[str, str | int]]:
    with (DATA_DIR / "base_vocabulary.json").open("r", encoding="utf-8") as file:
        return json.load(file)


def load_hidden_item_keys(db: Session) -> set[tuple[str, str]]:
    rows = db.scalars(select(HiddenQuizItem)).all()
    return {(row.item_id, row.source) for row in rows}


def load_visible_conjugation_entries(db: Session) -> list[dict[str, str | int]]:
    hidden_keys = load_hidden_item_keys(db)
    return [
        item
        for item in load_conjugation_entries()
        if (str(item["id"]), str(item.get("source", "conjugaison"))) not in hidden_keys
    ]


def load_visible_vocabulary_entries(db: Session) -> list[VocabularyEntry]:
    ensure_default_vocabulary(db)
    return db.scalars(select(VocabularyEntry).order_by(VocabularyEntry.id)).all()


def load_mastered_item_keys(db: Session, user_id: int) -> set[tuple[str, str]]:
    rows = db.scalars(
        select(UserQuizMastery).where(UserQuizMastery.user_id == user_id)
    ).all()
    return {
        (row.item_id, row.source)
        for row in rows
        if row.correct_fr_to_pt >= REVIEW_MASTERY_TARGET
        and row.correct_pt_to_fr >= REVIEW_MASTERY_TARGET
    }


def delete_vocabulary_entry_everywhere(db: Session, entry: VocabularyEntry) -> None:
    db.execute(
        delete(UserQuizMastery).where(
            UserQuizMastery.item_id == f"vocab-{entry.id}",
            UserQuizMastery.source == "vocab",
        )
    )
    db.delete(entry)
    db.commit()


def hide_conjugation_entry(db: Session, entry_id: str) -> None:
    existing = db.scalar(
        select(HiddenQuizItem).where(
            HiddenQuizItem.item_id == entry_id,
            HiddenQuizItem.source == "conjugaison",
        )
    )
    if existing is None:
        db.add(HiddenQuizItem(item_id=entry_id, source="conjugaison"))
        db.commit()


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
                difficulty=int(item.get("difficulty", 2)),
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


def _allocate_counts(total: int, available: dict[int, int], weights: dict[int, float]) -> dict[int, int]:
    if total <= 0:
        return {1: 0, 2: 0, 3: 0}

    raw_targets = {difficulty: total * weights[difficulty] for difficulty in (1, 2, 3)}
    counts = {
        difficulty: min(int(raw_targets[difficulty]), available.get(difficulty, 0))
        for difficulty in (1, 2, 3)
    }

    remaining = total - sum(counts.values())
    while remaining > 0:
        candidates = [
            difficulty
            for difficulty in (1, 2, 3)
            if counts[difficulty] < available.get(difficulty, 0)
        ]
        if not candidates:
            break

        difficulty = max(
            candidates,
            key=lambda current: (
                raw_targets[current] - counts[current],
                weights[current],
                available.get(current, 0) - counts[current],
            ),
        )
        counts[difficulty] += 1
        remaining -= 1

    return counts


def _sample_by_difficulty(
    pool: list[dict[str, str | int]],
    total: int,
    difficulty_profile: int,
) -> list[dict[str, str | int]]:
    if total <= 0:
        return []

    grouped = {
        difficulty: [item for item in pool if int(item.get("difficulty", 2)) == difficulty]
        for difficulty in (1, 2, 3)
    }
    counts = _allocate_counts(
        total,
        {difficulty: len(items) for difficulty, items in grouped.items()},
        DIFFICULTY_PROFILES[difficulty_profile],
    )

    sampled: list[dict[str, str | int]] = []
    for difficulty, items in grouped.items():
        sampled.extend(_sample(items, counts[difficulty]))

    random.shuffle(sampled)
    return sampled


def generate_quiz(
    db: Session,
    payload: QuizGenerateIn,
    *,
    user_id: int | None = None,
) -> QuizGenerateOut:
    vocab_entries = load_visible_vocabulary_entries(db)
    vocab_pool = [
        {
            "id": f"vocab-{entry.id}",
            "fr": entry.fr,
            "pt": entry.pt,
            "dir": entry.dir,
            "difficulty": entry.difficulty,
            "source": "vocab",
        }
        for entry in vocab_entries
    ]
    conjugation_pool = load_visible_conjugation_entries(db)

    if user_id is not None:
        mastered_keys = load_mastered_item_keys(db, user_id)
        if payload.mode == "review":
            vocab_pool = [
                item for item in vocab_pool if (str(item["id"]), str(item["source"])) in mastered_keys
            ]
            conjugation_pool = [
                item
                for item in conjugation_pool
                if (str(item["id"]), str(item.get("source", "conjugaison"))) in mastered_keys
            ]
        else:
            vocab_pool = [
                item for item in vocab_pool if (str(item["id"]), str(item["source"])) not in mastered_keys
            ]
            conjugation_pool = [
                item
                for item in conjugation_pool
                if (str(item["id"]), str(item.get("source", "conjugaison"))) not in mastered_keys
            ]

    if not vocab_pool and not conjugation_pool:
        if payload.mode == "review":
            raise ValueError("Aucune paire maîtrisée n’est disponible pour un quiz de révision.")
        raise ValueError("Aucune entrée n’est disponible pour générer un quiz.")

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

    chosen_vocab = _sample_by_difficulty(vocab_pool, vocab_count, payload.difficulty)
    chosen_conjugation = _sample_by_difficulty(
        conjugation_pool,
        conjugation_count,
        payload.difficulty,
    )

    items = [*chosen_vocab, *chosen_conjugation]
    random.shuffle(items)

    quiz_items = [QuizItemOut(**item) for item in items]

    return QuizGenerateOut(
        quiz_id=str(uuid4()),
        generated_at=datetime.now(timezone.utc),
        mode=payload.mode,
        requested_question_count=requested,
        actual_question_count=len(quiz_items),
        source_breakdown={
            "vocab": len(chosen_vocab),
            "conjugaison": len(chosen_conjugation),
        },
        items=quiz_items,
    )
