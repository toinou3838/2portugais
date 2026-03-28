from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.quiz import QuizGenerateIn, QuizGenerateOut
from app.schemas.translation import TranslationIn, TranslationOut
from app.services.quiz import generate_quiz
from app.services.translation import translate_text_strict

router = APIRouter(tags=["quiz"])


@router.post("/quiz/generate", response_model=QuizGenerateOut)
def create_quiz(
    payload: QuizGenerateIn,
    db: Annotated[Session, Depends(get_db)],
) -> QuizGenerateOut:
    return generate_quiz(db, payload)


@router.post("/translate", response_model=TranslationOut)
def translate(
    payload: TranslationIn,
) -> TranslationOut:
    result = translate_text_strict(payload.text, payload.direction)
    return TranslationOut(
        original_text=payload.text,
        translated_text=result.translated_text,
        direction=payload.direction,
        provider=result.provider,
        confidence=result.confidence,
        found=result.found,
    )
