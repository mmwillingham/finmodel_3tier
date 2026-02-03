"""add use_rmd to auto_disbursements

Revision ID: add_use_rmd_auto_disbursements_20260202
Revises: 20260202_add_distribution_fields_to_auto_disbursements
Create Date: 2026-02-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_use_rmd_auto_disbursements_20260202'
down_revision = '20260202_add_distribution_fields_to_auto_disbursements'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("auto_disbursements", sa.Column("use_rmd", sa.Boolean(), nullable=True, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("auto_disbursements", "use_rmd")

