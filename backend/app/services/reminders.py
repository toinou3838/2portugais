from __future__ import annotations

from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.services.progress import get_or_create_today_progress


def _send_resend_email(user: User, answered: int) -> None:
    if not settings.resend_api_key or not settings.reminder_from_email:
        raise RuntimeError("Resend not configured")

    remaining = max(settings.reminder_goal - answered, 0)
    httpx.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": settings.reminder_from_email,
            "to": [user.email],
            "subject": "Ton streak portugais t’attend",
            "html": (
                f"<p>Il te reste <strong>{remaining}</strong> questions pour atteindre "
                f"ton objectif quotidien sur O Mestre do Português.</p>"
            ),
        },
        timeout=10.0,
    ).raise_for_status()


def send_pending_reminders(db: Session) -> dict[str, int | datetime]:
    users = db.scalars(select(User).where(User.reminder_opt_in.is_(True))).all()
    processed = 0
    sent = 0
    dry_run = 0

    for user in users:
        progress = get_or_create_today_progress(db, user)
        if progress.goal_reached or progress.reminder_sent_at is not None:
            continue

        processed += 1
        if settings.resend_api_key and settings.reminder_from_email:
            _send_resend_email(user, progress.answered_questions)
            sent += 1
        else:
            dry_run += 1

        progress.reminder_sent_at = datetime.now(timezone.utc)
        db.add(progress)

    db.commit()
    return {
        "processed": processed,
        "sent": sent,
        "dry_run": dry_run,
        "timestamp": datetime.now(timezone.utc),
    }
