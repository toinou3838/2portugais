from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class VocabularyEntry(Base):
    __tablename__ = "vocabulary_entries"
    __table_args__ = (
        CheckConstraint("dir IN (0, 1)", name="ck_vocabulary_entries_dir"),
        CheckConstraint("difficulty IN (1, 2, 3)", name="ck_vocabulary_entries_difficulty"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    fr: Mapped[str] = mapped_column(String(255), nullable=False)
    pt: Mapped[str] = mapped_column(String(255), nullable=False)
    dir: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    difficulty: Mapped[int] = mapped_column(SmallInteger, default=2, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="vocab", index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    created_by_user: Mapped["User | None"] = relationship(back_populates="created_vocabulary_entries")
