"""add_calculate_state_tax_to_user_settings

Revision ID: 485d957f12fa
Revises: 564d5b7b32a4
Create Date: 2026-01-20 14:07:22.024978

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '485d957f12fa'
down_revision: Union[str, Sequence[str], None] = '564d5b7b32a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add calculate_state_tax column to user_settings table
    op.add_column('user_settings', sa.Column('calculate_state_tax', sa.Boolean(), nullable=True, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_settings', 'calculate_state_tax')
