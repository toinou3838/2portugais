from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserQuizMastery(TimestampMixin, Base):
    __tablename__ = "user_quiz_masteries"
    __table_args__ = (
        UniqueConstraint("user_id", "item_id", "source", name="uq_user_quiz_mastery_entry"),
        CheckConstraint("correct_fr_to_pt >= 0", name="ck_user_quiz_mastery_fr_non_negative"),
        CheckConstraint("correct_pt_to_fr >= 0", name="ck_user_quiz_mastery_pt_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    correct_fr_to_pt: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct_pt_to_fr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
