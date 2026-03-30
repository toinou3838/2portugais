"""add goal reached timestamp

Revision ID: 0002_goal_reached_at
Revises: 0001_initial
Create Date: 2026-03-29 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_goal_reached_at"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "daily_progress",
        sa.Column("goal_reached_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        """
        UPDATE daily_progress
        SET goal_reached_at = updated_at
        WHERE goal_reached = true AND goal_reached_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("daily_progress", "goal_reached_at")
