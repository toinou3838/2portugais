from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class AdminVerifyOut(BaseModel):
    ok: bool


class AdminConjugationRow(BaseModel):
    id: str
    fr: str
    pt: str
    dir: int
    difficulty: int
    source: str


class AdminVocabularyRow(BaseModel):
    id: int
    fr: str
    pt: str
    dir: int
    difficulty: int
    source: str
    created_by_user_id: int | None
    created_at: datetime


class AdminUserRow(BaseModel):
    id: int
    clerk_user_id: str
    email: str
    display_name: str | None
    reminder_opt_in: bool
    current_streak: int
    today_day: date
    today_answered_questions: int
    today_correct_answers: int
    today_quizzes_completed: int
    today_goal_reached: bool
    today_reminder_sent_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AdminReminderRow(BaseModel):
    id: int
    email: str
    display_name: str | None
    current_streak: int
    answered_questions: int
    remaining_questions: int
    reminder_opt_in: bool
    reminder_sent_at: datetime | None
    goal_reached: bool
    day: date


class AdminDashboardOut(BaseModel):
    conjugations: list[AdminConjugationRow]
    vocabulary: list[AdminVocabularyRow]
    users: list[AdminUserRow]
    pending_reminders: list[AdminReminderRow]

