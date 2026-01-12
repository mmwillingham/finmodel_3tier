"""add_allow_value_overwrite_to_cashflow_items

Revision ID: ea379df4dbf9
Revises: af46b15d055e
Create Date: 2026-01-12 14:11:34.357884

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea379df4dbf9'
down_revision: Union[str, Sequence[str], None] = 'af46b15d055e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add allow_value_overwrite column to cashflow_items table
    op.add_column('cashflow_items', sa.Column('allow_value_overwrite', sa.Boolean(), nullable=True, server_default='true'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('cashflow_items', 'allow_value_overwrite')
