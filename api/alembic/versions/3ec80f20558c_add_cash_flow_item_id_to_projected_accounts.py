"""add_cash_flow_item_id_to_projected_accounts

Revision ID: 3ec80f20558c
Revises: c134ab7e66dc
Create Date: 2026-01-14 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ec80f20558c'
down_revision: Union[str, Sequence[str], None] = 'c134ab7e66dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add cash_flow_item_id column to projected_accounts table
    # This allows reliable ID-based lookups instead of fragile description-based matching
    op.add_column('projected_accounts', sa.Column('cash_flow_item_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_projected_accounts_cash_flow_item_id',
        'projected_accounts',
        'cashflow_items',
        ['cash_flow_item_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_projected_accounts_cash_flow_item_id', 'projected_accounts', ['cash_flow_item_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Remove cash_flow_item_id column from projected_accounts table
    op.drop_index('ix_projected_accounts_cash_flow_item_id', table_name='projected_accounts')
    op.drop_constraint('fk_projected_accounts_cash_flow_item_id', 'projected_accounts', type_='foreignkey')
    op.drop_column('projected_accounts', 'cash_flow_item_id')
