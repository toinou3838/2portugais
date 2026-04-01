from __future__ import annotations

from datetime import date, datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict


class DailyProgressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    day: date
    answered_questions: int
    correct_answers: int
    quizzes_completed: int
    goal_reached: bool


class UserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    clerk_user_id: str
    email: str
    display_name: str | None
    avatar_url: str | None
    reminder_opt_in: bool
    current_streak: int
    goal: int
    questions_remaining_today: int
    today_progress: DailyProgressOut


class ReminderPreferenceIn(BaseModel):
    reminder_opt_in: bool


class MasteryUpdateIn(BaseModel):
    item_id: str
    source: Literal["conjugaison", "vocab"]
    direction: Literal[0, 1]
    correct: bool = True


class ProgressIn(BaseModel):
    quiz_id: str
    answered_questions: int
    correct_answers: int
    quizzes_completed: int = 1
    mastery_update: MasteryUpdateIn | None = None


class ReminderJobOut(BaseModel):
    processed: int
    sent: int
    dry_run: int
    window_open: bool
    scheduled_hour: str
    timezone: str
    timestamp: datetime
