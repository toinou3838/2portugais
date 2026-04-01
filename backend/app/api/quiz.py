from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_optional_auth_user
from app.db.session import get_db
from app.schemas.quiz import QuizGenerateIn, QuizGenerateOut
from app.schemas.translation import TranslationIn, TranslationOut
from app.services.clerk import AuthenticatedUser
from app.services.quiz import generate_quiz
from app.services.translation import translate_text_strict

router = APIRouter(tags=["quiz"])


@router.post("/quiz/generate", response_model=QuizGenerateOut)
def create_quiz(
    payload: QuizGenerateIn,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthenticatedUser | None, Depends(get_optional_auth_user)],
) -> QuizGenerateOut:
    if payload.mode == "review" and auth_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Connecte-toi pour lancer un quiz de révision.",
        )

    try:
        return generate_quiz(db, payload, user_id=auth_user.user.id if auth_user else None)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


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
