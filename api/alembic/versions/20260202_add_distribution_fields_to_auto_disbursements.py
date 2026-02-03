"""add distribution_type and taxable_income_cashflow_item_id to auto_disbursements

Revision ID: 20260202_dist_fields
Revises: a7fb52034cca
Create Date: 2026-02-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260202_dist_fields"
down_revision = "a7fb52034cca"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("auto_disbursements", sa.Column("distribution_type", sa.String(), nullable=True))
    op.add_column("auto_disbursements", sa.Column("taxable_income_cashflow_item_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_auto_disbursements_taxable_income_cashflow_item_id",
        "auto_disbursements", "cashflow_items",
        ["taxable_income_cashflow_item_id"], ["id"],
        ondelete="SET NULL"
    )

def downgrade() -> None:
    op.drop_constraint("fk_auto_disbursements_taxable_income_cashflow_item_id", "auto_disbursements", type_="foreignkey")
    op.drop_column("auto_disbursements", "taxable_income_cashflow_item_id")
    op.drop_column("auto_disbursements", "distribution_type")

