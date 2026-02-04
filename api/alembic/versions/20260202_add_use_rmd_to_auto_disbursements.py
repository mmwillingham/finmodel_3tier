"""add use_rmd to auto_disbursements

Revision ID: 20260202_use_rmd
Revises: 20260202_dist_fields
Create Date: 2026-02-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260202_use_rmd'
down_revision = '20260202_dist_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("auto_disbursements", sa.Column("use_rmd", sa.Boolean(), nullable=True, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("auto_disbursements", "use_rmd")

