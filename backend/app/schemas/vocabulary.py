from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class VocabularyCheckIn(BaseModel):
    fr: str = Field(min_length=1, max_length=255)
    pt: str = Field(min_length=1, max_length=255)


class VocabularyCheckOut(BaseModel):
    is_consistent: bool
    warning: str | None
    recommendation: dict[str, str] | None
    provider: str


class VocabularyCreateIn(BaseModel):
    fr: str = Field(min_length=1, max_length=255)
    pt: str = Field(min_length=1, max_length=255)
    difficulty: int = Field(default=2, ge=1, le=3)
    force_add: bool = False


class VocabularyEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fr: str
    pt: str
    dir: int
    difficulty: int
    source: str
    created_at: datetime


class GoogleSheetsSyncOut(BaseModel):
    imported: int
    skipped: int
    enabled: bool
