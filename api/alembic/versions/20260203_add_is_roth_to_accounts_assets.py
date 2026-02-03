"""add is_roth to accounts and assets

Revision ID: 20260203_add_is_roth
Revises: 20260203_merge_heads_rmd
Create Date: 2026-02-03 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260203_add_is_roth'
down_revision = '20260203_merge_heads_rmd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("is_roth", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("assets", sa.Column("is_roth", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("assets", "is_roth")
    op.drop_column("accounts", "is_roth")

