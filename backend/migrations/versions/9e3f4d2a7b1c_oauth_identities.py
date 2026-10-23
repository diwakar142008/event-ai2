"""Add OAuth identities and short-lived login attempts.

Revision ID: 9e3f4d2a7b1c
Revises: 8287eefd43da
Create Date: 2026-10-23
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "9e3f4d2a7b1c"
down_revision: str | None = "8287eefd43da"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "oauth_identities",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.String(length=32), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "subject", name="uq_oauth_identity_provider_subject"),
    )
    with op.batch_alter_table("oauth_identities", schema=None) as batch_op:
        batch_op.create_index("ix_oauth_identities_user_id", ["user_id"], unique=False)

    op.create_table(
        "oauth_login_attempts",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("state_hash", sa.String(length=64), nullable=False),
        sa.Column("browser_hash", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("code_verifier", sa.String(length=128), nullable=True),
        sa.Column("return_to", sa.String(length=20), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("state_hash"),
    )
def downgrade() -> None:
    op.drop_table("oauth_login_attempts")
    op.drop_table("oauth_identities")
