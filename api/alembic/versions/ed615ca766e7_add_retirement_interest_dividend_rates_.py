"""add_retirement_interest_dividend_rates_to_assets

Revision ID: ed615ca766e7
Revises: 034c62f91f59
Create Date: 2026-01-21 08:07:38.810298

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ed615ca766e7'
down_revision: Union[str, Sequence[str], None] = '034c62f91f59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add retirement_interest_rate and retirement_dividend_rate columns to assets table
    op.add_column('assets', sa.Column('retirement_interest_rate', sa.Float(), nullable=True))
    op.add_column('assets', sa.Column('retirement_dividend_rate', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('assets', 'retirement_dividend_rate')
    op.drop_column('assets', 'retirement_interest_rate')
