"""add quiz mastery and hidden quiz items

Revision ID: 0004_quiz_mastery
Revises: 0003_vocabulary_difficulty
Create Date: 2026-04-01 10:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0004_quiz_mastery"
down_revision = "0003_vocabulary_difficulty"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hidden_quiz_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("hidden_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["hidden_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("item_id", "source", name="uq_hidden_quiz_item"),
    )
    op.create_index(op.f("ix_hidden_quiz_items_hidden_by_user_id"), "hidden_quiz_items", ["hidden_by_user_id"], unique=False)
    op.create_index(op.f("ix_hidden_quiz_items_item_id"), "hidden_quiz_items", ["item_id"], unique=False)
    op.create_index(op.f("ix_hidden_quiz_items_source"), "hidden_quiz_items", ["source"], unique=False)

    op.create_table(
        "user_quiz_masteries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("correct_fr_to_pt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_pt_to_fr", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("correct_fr_to_pt >= 0", name="ck_user_quiz_mastery_fr_non_negative"),
        sa.CheckConstraint("correct_pt_to_fr >= 0", name="ck_user_quiz_mastery_pt_non_negative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "item_id", "source", name="uq_user_quiz_mastery_entry"),
    )
    op.create_index(op.f("ix_user_quiz_masteries_item_id"), "user_quiz_masteries", ["item_id"], unique=False)
    op.create_index(op.f("ix_user_quiz_masteries_source"), "user_quiz_masteries", ["source"], unique=False)
    op.create_index(op.f("ix_user_quiz_masteries_user_id"), "user_quiz_masteries", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_quiz_masteries_user_id"), table_name="user_quiz_masteries")
    op.drop_index(op.f("ix_user_quiz_masteries_source"), table_name="user_quiz_masteries")
    op.drop_index(op.f("ix_user_quiz_masteries_item_id"), table_name="user_quiz_masteries")
    op.drop_table("user_quiz_masteries")

    op.drop_index(op.f("ix_hidden_quiz_items_source"), table_name="hidden_quiz_items")
    op.drop_index(op.f("ix_hidden_quiz_items_item_id"), table_name="hidden_quiz_items")
    op.drop_index(op.f("ix_hidden_quiz_items_hidden_by_user_id"), table_name="hidden_quiz_items")
    op.drop_table("hidden_quiz_items")
