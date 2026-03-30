from __future__ import annotations

from datetime import datetime, timezone
from email.message import EmailMessage
import logging
import smtplib
from threading import Lock
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.services.progress import get_or_create_today_progress

_attempt_lock = Lock()
_last_attempt_key: str | None = None
logger = logging.getLogger("app.reminders")


def _send_resend_email(user: User, answered: int) -> None:
    if not settings.resend_api_key or not settings.reminder_from_email:
        raise RuntimeError("Resend not configured")

    remaining = max(settings.reminder_goal - answered, 0)
    logger.info("Sending reminder via Resend to %s (remaining=%s)", user.email, remaining)
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


def _send_smtp_email(user: User, answered: int) -> None:
    if not settings.smtp_username or not settings.smtp_password or not settings.reminder_from_email:
        raise RuntimeError("SMTP not configured")

    remaining = max(settings.reminder_goal - answered, 0)
    logger.info("Sending reminder via SMTP to %s (remaining=%s)", user.email, remaining)
    message = EmailMessage()
    message["Subject"] = "Ton streak portugais t’attend"
    message["From"] = settings.reminder_from_email
    message["To"] = user.email
    message.set_content(
        (
            f"Il te reste {remaining} questions pour atteindre "
            "ton objectif quotidien sur O Mestre do Português."
        )
    )
    message.add_alternative(
        (
            f"<p>Il te reste <strong>{remaining}</strong> questions pour atteindre "
            f"ton objectif quotidien sur O Mestre do Português.</p>"
        ),
        subtype="html",
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        if settings.smtp_starttls:
            server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)


def _send_reminder_email(user: User, answered: int) -> None:
    provider = settings.reminder_email_provider.strip().lower()
    logger.info("Reminder dispatch provider=%s user=%s", provider, user.email)
    if provider == "gmail":
        _send_smtp_email(user, answered)
        return
    if provider == "resend":
        _send_resend_email(user, answered)
        return
    raise RuntimeError("Unsupported REMINDER_EMAIL_PROVIDER")


def _is_reminder_window_open() -> bool:
    now_local = datetime.now(ZoneInfo(settings.reminder_timezone))
    current_clock = now_local.time().replace(second=0, microsecond=0)
    is_open = settings.reminder_send_time <= current_clock
    logger.info(
        "Reminder window check timezone=%s current=%s send_time=%s open=%s",
        settings.reminder_timezone,
        current_clock.strftime("%H:%M"),
        settings.reminder_send_time.strftime("%H:%M"),
        is_open,
    )
    return is_open


def _current_attempt_key() -> str:
    now_local = datetime.now(ZoneInfo(settings.reminder_timezone))
    return now_local.strftime("%Y-%m-%d-%H")


def should_attempt_automatic_reminders() -> bool:
    global _last_attempt_key

    if not settings.reminder_auto_run_enabled:
        logger.info("Automatic reminders disabled")
        return False

    if not _is_reminder_window_open():
        logger.info("Automatic reminders skipped because window is closed")
        return False

    attempt_key = _current_attempt_key()
    with _attempt_lock:
        if _last_attempt_key == attempt_key:
            logger.info("Automatic reminders already attempted for current hour key=%s", attempt_key)
            return False
        _last_attempt_key = attempt_key
        logger.info("Automatic reminders allowed for current hour key=%s", attempt_key)
        return True


def send_pending_reminders(db: Session) -> dict[str, int | datetime]:
    timestamp = datetime.now(timezone.utc)
    logger.info("Starting reminder scan at %s", timestamp.isoformat())
    if not _is_reminder_window_open():
        logger.info("Reminder scan aborted because window is closed")
        return {
            "processed": 0,
            "sent": 0,
            "dry_run": 0,
            "window_open": False,
            "scheduled_hour": settings.reminder_send_time.strftime("%H:%M"),
            "timezone": settings.reminder_timezone,
            "timestamp": timestamp,
        }

    users = db.scalars(select(User).where(User.reminder_opt_in.is_(True))).all()
    logger.info("Loaded %s reminder opt-in users", len(users))
    processed = 0
    sent = 0
    dry_run = 0

    for user in users:
        progress = get_or_create_today_progress(db, user)
        if progress.goal_reached or progress.reminder_sent_at is not None:
            logger.info(
                "Skipping reminder for %s goal_reached=%s reminder_sent_at=%s",
                user.email,
                progress.goal_reached,
                progress.reminder_sent_at.isoformat() if progress.reminder_sent_at else None,
            )
            continue

        processed += 1
        logger.info(
            "User eligible for reminder %s answered=%s goal=%s",
            user.email,
            progress.answered_questions,
            settings.reminder_goal,
        )
        if (
            settings.reminder_email_provider.strip().lower() == "gmail"
            and settings.smtp_username
            and settings.smtp_password
            and settings.reminder_from_email
        ) or (
            settings.reminder_email_provider.strip().lower() == "resend"
            and settings.resend_api_key
            and settings.reminder_from_email
        ):
            try:
                _send_reminder_email(user, progress.answered_questions)
                sent += 1
                logger.info("Reminder email sent to %s", user.email)
            except Exception:
                logger.exception("Reminder email send failed for %s", user.email)
                raise
        else:
            dry_run += 1
            logger.info("Dry run for %s because email provider config is incomplete", user.email)

        progress.reminder_sent_at = datetime.now(timezone.utc)
        db.add(progress)

    db.commit()
    logger.info("Reminder scan completed processed=%s sent=%s dry_run=%s", processed, sent, dry_run)
    return {
        "processed": processed,
        "sent": sent,
        "dry_run": dry_run,
        "window_open": True,
        "scheduled_hour": settings.reminder_send_time.strftime("%H:%M"),
        "timezone": settings.reminder_timezone,
        "timestamp": timestamp,
    }


def run_automatic_reminders_once() -> None:
    from app.db.session import SessionLocal

    logger.info("Automatic reminder background check triggered")
    if not should_attempt_automatic_reminders():
        logger.info("Automatic reminder background check exited early")
        return

    with SessionLocal() as session:
        logger.info("Automatic reminder background check opened database session")
        send_pending_reminders(session)
