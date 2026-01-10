"""add dividend reinvestment to cashflow_items

Revision ID: add_dividend_reinvestment
Revises: add_cash_asset_ids
Create Date: 2026-01-10 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_dividend_reinvestment'
down_revision: Union[str, Sequence[str], None] = 'add_cash_asset_ids'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add reinvest_dividends column to cashflow_items table
    op.add_column('cashflow_items', sa.Column('reinvest_dividends', sa.Boolean(), nullable=True, server_default='false'))
    # Add reinvestment_account_id column (ForeignKey to assets table)
    op.add_column('cashflow_items', sa.Column('reinvestment_account_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_cashflow_items_reinvestment_account_id',
        'cashflow_items', 'assets',
        ['reinvestment_account_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_cashflow_items_reinvestment_account_id', 'cashflow_items', type_='foreignkey')
    op.drop_column('cashflow_items', 'reinvestment_account_id')
    op.drop_column('cashflow_items', 'reinvest_dividends')
