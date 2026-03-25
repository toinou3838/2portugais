from __future__ import annotations

from typing import Annotated

import random

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_auth_user
from app.db.session import get_db
from app.models.vocabulary_entry import VocabularyEntry
from app.schemas.vocabulary import (
    VocabularyCheckIn,
    VocabularyCheckOut,
    VocabularyCreateIn,
    VocabularyEntryOut,
)
from app.services.clerk import AuthenticatedUser
from app.services.translation import check_vocabulary_consistency

router = APIRouter(tags=["vocabulary"])


@router.get("/vocabulary", response_model=list[VocabularyEntryOut])
def list_vocabulary(
    _: Annotated[AuthenticatedUser, Depends(get_current_auth_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=10, ge=1, le=50),
) -> list[VocabularyEntryOut]:
    entries = db.scalars(
        select(VocabularyEntry)
        .order_by(VocabularyEntry.created_at.desc(), VocabularyEntry.id.desc())
        .limit(limit)
    ).all()
    return [VocabularyEntryOut.model_validate(entry) for entry in entries]


@router.post("/vocabulary/check", response_model=VocabularyCheckOut)
def check_vocabulary(
    payload: VocabularyCheckIn,
    _: Annotated[AuthenticatedUser, Depends(get_current_auth_user)],
    db: Annotated[Session, Depends(get_db)],
) -> VocabularyCheckOut:
    return VocabularyCheckOut(**check_vocabulary_consistency(db, payload.fr, payload.pt))


@router.post("/vocabulary", response_model=VocabularyEntryOut, status_code=status.HTTP_201_CREATED)
def create_vocabulary_entry(
    payload: VocabularyCreateIn,
    auth_user: Annotated[AuthenticatedUser, Depends(get_current_auth_user)],
    db: Annotated[Session, Depends(get_db)],
) -> VocabularyEntryOut:
    normalized_fr = payload.fr.strip().lower()
    normalized_pt = payload.pt.strip().lower()
    existing = db.scalar(
        select(VocabularyEntry).where(
            func.lower(VocabularyEntry.fr) == normalized_fr,
            func.lower(VocabularyEntry.pt) == normalized_pt,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette paire existe déjà dans la base.",
        )

    check = check_vocabulary_consistency(db, payload.fr, payload.pt)
    if not check["is_consistent"] and not payload.force_add:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=check["warning"] or "Potential vocabulary inconsistency",
        )

    entry = VocabularyEntry(
        fr=normalized_fr,
        pt=normalized_pt,
        dir=random.choice([0, 1]),
        source="vocab",
        created_by_user_id=auth_user.user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return VocabularyEntryOut.model_validate(entry)
