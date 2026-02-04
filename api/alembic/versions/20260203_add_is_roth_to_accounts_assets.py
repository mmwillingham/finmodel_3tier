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
    conn = op.get_bind()
    # Add is_roth to accounts if missing
    has_accounts_col = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts' AND column_name='is_roth'"
        )
    ).fetchone()
    if not has_accounts_col:
        op.add_column("accounts", sa.Column("is_roth", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # Add is_roth to assets if missing
    has_assets_col = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='is_roth'"
        )
    ).fetchone()
    if not has_assets_col:
        op.add_column("assets", sa.Column("is_roth", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    conn = op.get_bind()
    has_assets_col = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='is_roth'"
        )
    ).fetchone()
    if has_assets_col:
        op.drop_column("assets", "is_roth")

    has_accounts_col = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts' AND column_name='is_roth'"
        )
    ).fetchone()
    if has_accounts_col:
        op.drop_column("accounts", "is_roth")

