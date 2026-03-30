from __future__ import annotations

from dataclasses import dataclass

import httpx
from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

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
    source_lang = "fr" if direction == "fr_to_pt" else "pt"
    target_lang = "pt" if direction == "fr_to_pt" else "fr"

    if settings.translation_provider == "gemini" and settings.gemini_api_key:
        target_label = "portugais brésilien naturel" if direction == "fr_to_pt" else "français naturel"
        response = httpx.post(
            settings.gemini_api_base_url.rstrip("/")
            + f"/models/{settings.gemini_model}:generateContent",
            timeout=15.0,
            headers={"Content-Type": "application/json"},
            params={"key": settings.gemini_api_key},
            json={
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": (
                                    "Tu es un traducteur strict. Réponds uniquement avec la "
                                    "traduction finale, sans explication, sans guillemets, "
                                    "sans variantes et sans ponctuation ajoutée. "
                                    f"Traduis en {target_label} : {text}"
                                ),
                            }
                        ],
                    },
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 80,
                },
            },
        )
        response.raise_for_status()
        payload = response.json()
        translated = ""
        candidates = payload.get("candidates") or []
        for candidate in candidates:
            content = candidate.get("content") or {}
            for part in content.get("parts", []):
                text_value = str(part.get("text", "")).strip().lower()
                if text_value:
                    translated = text_value
                    break
            if translated:
                break
        if not translated:
            return None
        return TranslationResult(
            translated_text=translated,
            provider="gemini",
            confidence=0.95,
            found=True,
        )

    if settings.translation_provider == "deepl" and settings.deepl_api_key:
        deepl_target = "PT-PT" if target_lang == "pt" else "FR"
        response = httpx.post(
            settings.deepl_api_url.rstrip("/") + "/v2/translate",
            timeout=10.0,
            headers={
                "Authorization": f"DeepL-Auth-Key {settings.deepl_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "text": [text],
                "source_lang": source_lang.upper(),
                "target_lang": deepl_target,
            },
        )
        response.raise_for_status()
        payload = response.json()
        translations = payload.get("translations") or []
        if not translations:
            return None
        translated = str(translations[0].get("text", "")).strip().lower()
        if not translated:
            return None
        return TranslationResult(
            translated_text=translated,
            provider="deepl",
            confidence=0.97,
            found=True,
        )

    if settings.translation_provider == "libretranslate" and settings.libretranslate_url:
        response = httpx.post(
            settings.libretranslate_url.rstrip("/") + "/translate",
            timeout=10.0,
            json={
                "q": text,
                "source": source_lang,
                "target": target_lang,
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

    params = {
        "q": text,
        "langpair": f"{source_lang}|{target_lang}",
    }
    if settings.mymemory_contact_email:
        params["de"] = settings.mymemory_contact_email

    response = httpx.get(
        "https://api.mymemory.translated.net/get",
        params=params,
        timeout=10.0,
    )
    response.raise_for_status()
    payload = response.json()
    response_data = payload.get("responseData") or {}
    translated = str(response_data.get("translatedText", "")).strip().lower()
    if not translated:
        return None

    quality = payload.get("responseStatus")
    confidence = 0.86 if quality == 200 else 0.72
    return TranslationResult(
        translated_text=translated,
        provider="mymemory",
        confidence=confidence,
        found=True,
    )


def translate_text(db: Session, text: str, direction: str) -> TranslationResult:
    local_result = _local_translate(db, text, direction)

    if settings.translation_provider != "local":
        try:
            remote_result = _remote_translate(text, direction)
            if remote_result:
                return remote_result
        except httpx.HTTPError:
            pass

    if local_result.found:
        return local_result

    return local_result


def translate_text_strict(text: str, direction: str) -> TranslationResult:
    if settings.translation_provider != "gemini":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini is required for live translation. Set TRANSLATION_PROVIDER=gemini.",
        )
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY is missing on the backend.",
        )

    try:
        result = _remote_translate(text, direction)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini request failed.",
        ) from exc

    if not result or result.provider != "gemini":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini did not return a usable translation.",
        )

    return result


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
