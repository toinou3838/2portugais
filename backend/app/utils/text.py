from __future__ import annotations

import re
import unicodedata

from rapidfuzz import fuzz


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    lowered = without_accents.lower()
    lowered = lowered.replace("’", "").replace("'", "")
    cleaned = re.sub(r"[.,!?;:()[\]{}\"“”«»]", " ", lowered)
    return re.sub(r"\s+", " ", cleaned).strip()


def similarity(answer: str, expected: str) -> int:
    if not answer or not expected:
        return 0
    return int(round(fuzz.ratio(answer, expected)))


def is_close_match(answer: str, expected: str, threshold: int = 88) -> bool:
    normalized_answer = normalize_text(answer)
    normalized_expected = normalize_text(expected)
    if not normalized_answer or not normalized_expected:
        return False
    score = similarity(normalized_answer, normalized_expected)
    return (
        normalized_answer == normalized_expected
        or score >= threshold
        or (normalized_expected.find(normalized_answer) >= 0 and len(normalized_answer) >= 4)
    )

