"""add cash_asset_ids to user_settings

Revision ID: add_cash_asset_ids
Revises: 54886b70f774
Create Date: 2026-01-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_cash_asset_ids'
down_revision: Union[str, Sequence[str], None] = '54886b70f774'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add cash_asset_ids column to user_settings table (JSON array of asset IDs)
    op.add_column('user_settings', sa.Column('cash_asset_ids', sa.JSON(), nullable=True, server_default='[]'))
    # Add cash_in_source_ids column (JSON array of income item IDs, empty means all income)
    op.add_column('user_settings', sa.Column('cash_in_source_ids', sa.JSON(), nullable=True, server_default='[]'))
    # Add cash_out_source_ids column (JSON array of expense item IDs, empty means all expenses)
    op.add_column('user_settings', sa.Column('cash_out_source_ids', sa.JSON(), nullable=True, server_default='[]'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_settings', 'cash_out_source_ids')
    op.drop_column('user_settings', 'cash_in_source_ids')
    op.drop_column('user_settings', 'cash_asset_ids')
