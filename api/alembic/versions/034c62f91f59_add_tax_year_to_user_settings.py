"""add_tax_year_to_user_settings

Revision ID: 034c62f91f59
Revises: 485d957f12fa
Create Date: 2026-01-20 14:22:56.560384

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '034c62f91f59'
down_revision: Union[str, Sequence[str], None] = '485d957f12fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add tax_year column to user_settings table
    op.add_column('user_settings', sa.Column('tax_year', sa.Integer(), nullable=True, server_default='2025'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_settings', 'tax_year')
