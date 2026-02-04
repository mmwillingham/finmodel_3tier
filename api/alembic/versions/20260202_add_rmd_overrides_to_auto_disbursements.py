"""add rmd_overrides to auto_disbursements

Revision ID: 20260202_rmd_overrides
Revises: 20260202_use_rmd
Create Date: 2026-02-02 00:10:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260202_rmd_overrides'
down_revision = '20260202_use_rmd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("auto_disbursements", sa.Column("rmd_overrides", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("auto_disbursements", "rmd_overrides")

