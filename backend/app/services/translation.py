from __future__ import annotations

from dataclasses import dataclass

import httpx
from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.vocabulary_entry import VocabularyEntry
from app.utils.text import is_close_match, normalize_text
from app.services.quiz import load_conjugation_entries, ensure_default_vocabulary


@dataclass
class TranslationResult:
    translated_text: str
    provider: str
    confidence: float
    found: bool


def _local_candidates(db: Session, direction: str) -> list[tuple[str, str]]:
    ensure_default_vocabulary(db)
    vocab_entries = db.scalars(select(VocabularyEntry)).all()
    conjugation_entries = load_conjugation_entries()

    local_pairs = []
    for entry in vocab_entries:
        local_pairs.append((entry.fr, entry.pt))
    for entry in conjugation_entries:
        local_pairs.append((str(entry["fr"]), str(entry["pt"])))

    if direction == "pt_to_fr":
        return [(pt, fr) for fr, pt in local_pairs]
    return local_pairs


def _local_translate(db: Session, text: str, direction: str) -> TranslationResult:
    target = normalize_text(text)
    best_score = -1
    best_value = ""

    for source, translated in _local_candidates(db, direction):
        normalized_source = normalize_text(source)
        if not normalized_source:
            continue
        if is_close_match(target, normalized_source, threshold=96):
            return TranslationResult(
                translated_text=translated.lower(),
                provider="local",
                confidence=1.0,
                found=True,
            )

        score = fuzz.WRatio(target, normalized_source)
        if score > best_score:
            best_score = score
            best_value = translated

    if best_score >= 65:
        return TranslationResult(
            translated_text=best_value.lower(),
            provider="local-fuzzy",
            confidence=round(best_score / 100, 2),
            found=True,
        )

    return TranslationResult(
        translated_text=best_value.lower() if best_value else "",
        provider="local-fuzzy",
        confidence=max(best_score, 0) / 100,
        found=False,
    )


def _remote_translate(text: str, direction: str) -> TranslationResult | None:
    if settings.translation_provider != "libretranslate" or not settings.libretranslate_url:
        return None

    response = httpx.post(
        settings.libretranslate_url.rstrip("/") + "/translate",
        timeout=10.0,
        json={
            "q": text,
            "source": "fr" if direction == "fr_to_pt" else "pt",
            "target": "pt" if direction == "fr_to_pt" else "fr",
            "api_key": settings.libretranslate_api_key,
        },
    )
    response.raise_for_status()
    payload = response.json()
    translated = str(payload.get("translatedText", "")).strip().lower()
    if not translated:
        return None
    return TranslationResult(
        translated_text=translated,
        provider="libretranslate",
        confidence=0.92,
        found=True,
    )


def translate_text(db: Session, text: str, direction: str) -> TranslationResult:
    local_result = _local_translate(db, text, direction)
    if local_result.found:
        return local_result

    remote_result = _remote_translate(text, direction)
    if remote_result:
        return remote_result

    return local_result


def check_vocabulary_consistency(db: Session, fr: str, pt: str) -> dict[str, object]:
    suggested = translate_text(db, fr, "fr_to_pt")
    reverse = translate_text(db, pt, "pt_to_fr")

    normalized_fr = normalize_text(fr)
    normalized_pt = normalize_text(pt)

    suggested_pt = normalize_text(suggested.translated_text)
    reverse_fr = normalize_text(reverse.translated_text)

    forward_match = bool(suggested_pt) and is_close_match(normalized_pt, suggested_pt)
    reverse_match = bool(reverse_fr) and is_close_match(normalized_fr, reverse_fr)
    consistent = forward_match or reverse_match

    recommendation = None
    warning = None

    if not consistent and suggested.translated_text:
        recommendation = {"fr": fr.strip().lower(), "pt": suggested.translated_text}
        warning = (
            f"La traduction suggérée pour « {fr.strip()} » semble plutôt être "
            f"« {suggested.translated_text} »."
        )

    return {
        "is_consistent": consistent,
        "warning": warning,
        "recommendation": recommendation,
        "provider": suggested.provider,
    }

