from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import verify_job_secret
from app.db.session import get_db
from app.schemas.profile import ReminderJobOut
from app.schemas.vocabulary import GoogleSheetsSyncOut
from app.services.google_sheets import sync_google_sheet_vocabulary
from app.services.reminders import send_pending_reminders

router = APIRouter(tags=["jobs"])


@router.post("/jobs/reminders/send", response_model=ReminderJobOut, dependencies=[Depends(verify_job_secret)])
def send_reminders(
    db: Annotated[Session, Depends(get_db)],
) -> ReminderJobOut:
    return ReminderJobOut(**send_pending_reminders(db))


@router.post("/jobs/google-sheets/sync", response_model=GoogleSheetsSyncOut, dependencies=[Depends(verify_job_secret)])
def sync_google_sheets(
    db: Annotated[Session, Depends(get_db)],
) -> GoogleSheetsSyncOut:
    return GoogleSheetsSyncOut(**sync_google_sheet_vocabulary(db))

