from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class QuizGenerateIn(BaseModel):
    question_count: int = Field(default=20, ge=5, le=200)
    conjugation_percentage: int = Field(default=10, ge=0, le=100)
    difficulty: int = Field(default=2, ge=1, le=3)


class QuizItemOut(BaseModel):
    id: str
    fr: str
    pt: str
    dir: Literal[0, 1]
    difficulty: Literal[1, 2, 3]
    source: Literal["conjugaison", "vocab"]


class QuizGenerateOut(BaseModel):
    quiz_id: str
    generated_at: datetime
    requested_question_count: int
    actual_question_count: int
    source_breakdown: dict[str, int]
    items: list[QuizItemOut]
