from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.daily_progress import DailyProgress
from app.models.user import User
from app.schemas.profile import DailyProgressOut, ProgressIn, UserProfileOut


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
            DailyProgress.goal_reached.is_(True),
        )
        .order_by(DailyProgress.day.desc())
    ).all()

    achieved_days = {row.day for row in rows}
    today = date.today()
    expected = today if today in achieved_days else today - timedelta(days=1)
    if expected not in achieved_days:
        return 0

    streak = 0
    while expected in achieved_days:
        streak += 1
        expected -= timedelta(days=1)
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
    progress.answered_questions += payload.answered_questions
    progress.correct_answers += payload.correct_answers
    progress.quizzes_completed += payload.quizzes_completed
    progress.goal_reached = progress.answered_questions >= settings.reminder_goal
    progress.updated_at = datetime.now(timezone.utc)

    db.add(progress)
    db.commit()
    db.refresh(progress)
    return build_user_profile(db, user)

