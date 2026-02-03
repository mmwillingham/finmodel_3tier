"""add rmd_overrides to auto_disbursements

Revision ID: add_rmd_overrides_auto_disbursements_20260202
Revises: add_use_rmd_auto_disbursements_20260202
Create Date: 2026-02-02 00:10:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_rmd_overrides_auto_disbursements_20260202'
down_revision = 'add_use_rmd_auto_disbursements_20260202'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("auto_disbursements", sa.Column("rmd_overrides", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("auto_disbursements", "rmd_overrides")

