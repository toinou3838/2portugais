from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.daily_progress import DailyProgress
    from app.models.vocabulary_entry import VocabularyEntry


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    clerk_user_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminder_opt_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    daily_progress_entries: Mapped[list["DailyProgress"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    created_vocabulary_entries: Mapped[list["VocabularyEntry"]] = relationship(
        back_populates="created_by_user"
    )

