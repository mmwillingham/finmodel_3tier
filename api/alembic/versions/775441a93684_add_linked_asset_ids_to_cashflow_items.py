"""add_linked_asset_ids_to_cashflow_items

Revision ID: 775441a93684
Revises: e4f5a6b7c8d9
Create Date: 2026-01-05 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '775441a93684'
down_revision: Union[str, Sequence[str], None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add linked_asset_ids JSON column to cashflow_items table
    op.add_column('cashflow_items', sa.Column('linked_asset_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove linked_asset_ids column from cashflow_items table
    op.drop_column('cashflow_items', 'linked_asset_ids')

