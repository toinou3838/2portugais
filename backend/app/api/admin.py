from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import verify_admin_code
from app.core.config import settings
from app.db.session import get_db
from app.models.daily_progress import DailyProgress
from app.models.user import User
from app.models.vocabulary_entry import VocabularyEntry
from app.schemas.admin import (
    AdminConjugationRow,
    AdminDashboardOut,
    AdminReminderRow,
    AdminUserRow,
    AdminVerifyOut,
    AdminVocabularyRow,
)
from app.services.progress import compute_current_streak
from app.services.quiz import load_conjugation_entries

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(verify_admin_code)])


@router.get("/verify", response_model=AdminVerifyOut)
def verify_admin_access() -> AdminVerifyOut:
    return AdminVerifyOut(ok=True)


@router.get("/dashboard", response_model=AdminDashboardOut)
def read_admin_dashboard(
    db: Annotated[Session, Depends(get_db)],
) -> AdminDashboardOut:
    conjugations = [
        AdminConjugationRow(
            id=str(item["id"]),
            fr=str(item["fr"]),
            pt=str(item["pt"]),
            dir=int(item["dir"]),
            difficulty=int(item.get("difficulty", 2)),
            source=str(item.get("source", "conjugaison")),
        )
        for item in load_conjugation_entries()
    ]

    user_rows = db.scalars(select(User).order_by(User.updated_at.desc(), User.id.desc())).all()
    user_display_names = {
        user.id: user.display_name or user.email or f"Utilisateur #{user.id}" for user in user_rows
    }

    vocabulary_entries = db.scalars(
        select(VocabularyEntry)
        .order_by(VocabularyEntry.created_at.desc(), VocabularyEntry.id.desc())
    ).all()
    vocabulary = [
        AdminVocabularyRow(
            id=entry.id,
            fr=entry.fr,
            pt=entry.pt,
            dir=entry.dir,
            difficulty=entry.difficulty,
            source=entry.source,
            created_by_user_id=entry.created_by_user_id,
            created_by_display_name=(
                "Système"
                if entry.created_by_user_id is None
                else user_display_names.get(entry.created_by_user_id, "Utilisateur inconnu")
            ),
            created_at=entry.created_at,
        )
        for entry in vocabulary_entries
    ]

    users: list[AdminUserRow] = []
    pending_reminders: list[AdminReminderRow] = []
    today = datetime.now().date()
    for user in user_rows:
        today_progress = db.scalar(
            select(DailyProgress).where(
                DailyProgress.user_id == user.id,
                DailyProgress.day == today,
            )
        )
        if today_progress is None:
            today_answered_questions = 0
            today_correct_answers = 0
            today_quizzes_completed = 0
            today_goal_reached = False
            today_reminder_sent_at = None
            today_day = today
        else:
            today_answered_questions = today_progress.answered_questions
            today_correct_answers = today_progress.correct_answers
            today_quizzes_completed = today_progress.quizzes_completed
            today_goal_reached = today_progress.goal_reached
            today_reminder_sent_at = today_progress.reminder_sent_at
            today_day = today_progress.day
        streak = compute_current_streak(db, user)
        users.append(
            AdminUserRow(
                id=user.id,
                clerk_user_id=user.clerk_user_id,
                email=user.email,
                display_name=user.display_name,
                reminder_opt_in=user.reminder_opt_in,
                current_streak=streak,
                today_day=today_day,
                today_answered_questions=today_answered_questions,
                today_correct_answers=today_correct_answers,
                today_quizzes_completed=today_quizzes_completed,
                today_goal_reached=today_goal_reached,
                today_reminder_sent_at=today_reminder_sent_at,
                created_at=user.created_at,
                updated_at=user.updated_at,
            )
        )

        if user.reminder_opt_in and not today_goal_reached and today_reminder_sent_at is None:
            pending_reminders.append(
                AdminReminderRow(
                    id=user.id,
                    email=user.email,
                    display_name=user.display_name,
                    current_streak=streak,
                    answered_questions=today_answered_questions,
                    remaining_questions=max(settings.reminder_goal - today_answered_questions, 0),
                    reminder_opt_in=user.reminder_opt_in,
                    reminder_sent_at=today_reminder_sent_at,
                    goal_reached=today_goal_reached,
                    day=today_day,
                )
            )

    pending_reminders.sort(key=lambda row: (row.remaining_questions, -row.current_streak, row.email))

    return AdminDashboardOut(
        conjugations=conjugations,
        vocabulary=vocabulary,
        users=users,
        pending_reminders=pending_reminders,
    )
