from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.daily_progress import DailyProgress
from app.models.user import User
from app.schemas.profile import DailyProgressOut, ProgressIn, UserProfileOut

MAX_STREAK_INTERVAL = timedelta(hours=30)


def _next_local_midnight_after(timestamp: datetime) -> datetime:
    local_timezone = ZoneInfo(settings.reminder_timezone)
    local_time = timestamp.astimezone(local_timezone)
    next_day = local_time.date() + timedelta(days=1)
    return datetime.combine(next_day, time.min, tzinfo=local_timezone).astimezone(
        timezone.utc
    )


def get_or_create_today_progress(db: Session, user: User) -> DailyProgress:
    today = date.today()
    progress = db.scalar(
        select(DailyProgress).where(
            DailyProgress.user_id == user.id,
            DailyProgress.day == today,
        )
    )
    if progress is None:
        progress = DailyProgress(user_id=user.id, day=today)
        db.add(progress)
        db.commit()
        db.refresh(progress)
    return progress


def compute_current_streak(db: Session, user: User) -> int:
    rows = db.scalars(
        select(DailyProgress)
        .where(
            DailyProgress.user_id == user.id,
            DailyProgress.goal_reached_at.is_not(None),
        )
        .order_by(DailyProgress.goal_reached_at.asc())
    ).all()

    if not rows:
        return 0

    streak = 1
    anchor = rows[0].goal_reached_at
    assert anchor is not None

    for row in rows[1:]:
        achieved_at = row.goal_reached_at
        if achieved_at is None:
            continue

        window_start = _next_local_midnight_after(anchor)
        window_end = anchor + MAX_STREAK_INTERVAL

        if window_start <= achieved_at <= window_end:
            streak += 1
            anchor = achieved_at
            continue

        streak = 1
        anchor = achieved_at

    if datetime.now(timezone.utc) - anchor > MAX_STREAK_INTERVAL:
        return 0

    return streak


def build_user_profile(db: Session, user: User) -> UserProfileOut:
    today_progress = get_or_create_today_progress(db, user)
    goal = settings.reminder_goal

    return UserProfileOut(
        id=user.id,
        clerk_user_id=user.clerk_user_id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        reminder_opt_in=user.reminder_opt_in,
        current_streak=compute_current_streak(db, user),
        goal=goal,
        questions_remaining_today=max(goal - today_progress.answered_questions, 0),
        today_progress=DailyProgressOut.model_validate(today_progress),
    )


def update_progress(db: Session, user: User, payload: ProgressIn) -> UserProfileOut:
    progress = get_or_create_today_progress(db, user)
    previously_reached = progress.goal_reached
    progress.answered_questions += payload.answered_questions
    progress.correct_answers += payload.correct_answers
    progress.quizzes_completed += payload.quizzes_completed
    progress.goal_reached = progress.answered_questions >= settings.reminder_goal
    if progress.goal_reached and not previously_reached:
        progress.goal_reached_at = datetime.now(timezone.utc)
    progress.updated_at = datetime.now(timezone.utc)

    db.add(progress)
    db.commit()
    db.refresh(progress)
    return build_user_profile(db, user)
