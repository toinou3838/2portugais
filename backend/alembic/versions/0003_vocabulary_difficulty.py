"""add vocabulary difficulty

Revision ID: 0003_vocabulary_difficulty
Revises: 0002_goal_reached_at
Create Date: 2026-03-29 00:30:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import re


revision = "0003_vocabulary_difficulty"
down_revision = "0002_goal_reached_at"
branch_labels = None
depends_on = None


def _infer_vocabulary_difficulty(text: str) -> int:
    normalized = text.strip().lower()
    words = [word for word in re.split(r"\s+", normalized) if word]
    if any(marker in normalized for marker in ["/", "...", "?", "(", ")"]) or len(words) >= 3:
        return 3
    if len(words) == 1:
        return 1
    return 2


def upgrade() -> None:
    op.add_column(
        "vocabulary_entries",
        sa.Column("difficulty", sa.SmallInteger(), nullable=False, server_default="2"),
    )
    op.create_check_constraint(
        "ck_vocabulary_entries_difficulty",
        "vocabulary_entries",
        "difficulty IN (1, 2, 3)",
    )
    connection = op.get_bind()
    vocabulary_entries = sa.table(
        "vocabulary_entries",
        sa.column("id", sa.Integer),
        sa.column("fr", sa.String),
        sa.column("difficulty", sa.SmallInteger),
    )
    rows = connection.execute(sa.select(vocabulary_entries.c.id, vocabulary_entries.c.fr)).all()
    for row in rows:
        connection.execute(
            vocabulary_entries.update()
            .where(vocabulary_entries.c.id == row.id)
            .values(difficulty=_infer_vocabulary_difficulty(row.fr))
        )


def downgrade() -> None:
    op.drop_constraint("ck_vocabulary_entries_difficulty", "vocabulary_entries", type_="check")
    op.drop_column("vocabulary_entries", "difficulty")
