"""initial tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-03-25 01:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("clerk_user_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("reminder_opt_in", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clerk_user_id"),
    )
    op.create_index("ix_users_clerk_user_id", "users", ["clerk_user_id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "daily_progress",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("answered_questions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_answers", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quizzes_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("goal_reached", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "day", name="uq_daily_progress_user_day"),
    )
    op.create_index("ix_daily_progress_day", "daily_progress", ["day"], unique=False)
    op.create_index("ix_daily_progress_user_id", "daily_progress", ["user_id"], unique=False)

    op.create_table(
        "vocabulary_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fr", sa.String(length=255), nullable=False),
        sa.Column("pt", sa.String(length=255), nullable=False),
        sa.Column("dir", sa.SmallInteger(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="vocab"),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("dir IN (0, 1)", name="ck_vocabulary_entries_dir"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vocabulary_entries_created_by_user_id", "vocabulary_entries", ["created_by_user_id"], unique=False)
    op.create_index("ix_vocabulary_entries_source", "vocabulary_entries", ["source"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_vocabulary_entries_source", table_name="vocabulary_entries")
    op.drop_index("ix_vocabulary_entries_created_by_user_id", table_name="vocabulary_entries")
    op.drop_table("vocabulary_entries")
    op.drop_index("ix_daily_progress_user_id", table_name="daily_progress")
    op.drop_index("ix_daily_progress_day", table_name="daily_progress")
    op.drop_table("daily_progress")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_clerk_user_id", table_name="users")
    op.drop_table("users")

