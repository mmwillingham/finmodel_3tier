"""add calculate_federal_tax to user_settings

Revision ID: add_calculate_federal_tax
Revises: add_dividend_reinvestment
Create Date: 2026-01-10 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_calculate_federal_tax'
down_revision: Union[str, Sequence[str], None] = 'add_dividend_reinvestment'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add calculate_federal_tax column to user_settings table
    op.add_column('user_settings', sa.Column('calculate_federal_tax', sa.Boolean(), nullable=True, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_settings', 'calculate_federal_tax')
