"""add_is_qualified_dividend_to_cashflow_items

Revision ID: 3e1baed9621f
Revises: add_calculate_federal_tax
Create Date: 2026-01-12 12:16:23.099691

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e1baed9621f'
down_revision: Union[str, Sequence[str], None] = 'add_calculate_federal_tax'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add is_qualified_dividend column to cashflow_items table
    op.add_column('cashflow_items', sa.Column('is_qualified_dividend', sa.Boolean(), nullable=True, server_default='true'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('cashflow_items', 'is_qualified_dividend')
