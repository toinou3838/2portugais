from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_auth_user
from app.db.session import get_db
from app.schemas.profile import ProgressIn, ReminderPreferenceIn, UserProfileOut
from app.services.clerk import AuthenticatedUser
from app.services.progress import build_user_profile, update_progress

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserProfileOut)
def read_me(
    auth_user: Annotated[AuthenticatedUser, Depends(get_current_auth_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserProfileOut:
    return build_user_profile(db, auth_user.user)


@router.post("/progress", response_model=UserProfileOut)
def post_progress(
    payload: ProgressIn,
    auth_user: Annotated[AuthenticatedUser, Depends(get_current_auth_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserProfileOut:
    return update_progress(db, auth_user.user, payload)


@router.post("/preferences/reminders", response_model=UserProfileOut)
def update_reminder_preference(
    payload: ReminderPreferenceIn,
    auth_user: Annotated[AuthenticatedUser, Depends(get_current_auth_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserProfileOut:
    auth_user.user.reminder_opt_in = payload.reminder_opt_in
    db.add(auth_user.user)
    db.commit()
    db.refresh(auth_user.user)
    return build_user_profile(db, auth_user.user)

