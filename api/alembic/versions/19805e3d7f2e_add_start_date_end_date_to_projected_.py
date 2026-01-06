"""add_start_date_end_date_to_projected_accounts

Revision ID: 19805e3d7f2e
Revises: 775441a93684
Create Date: 2026-01-06 14:13:33.120203

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '19805e3d7f2e'
down_revision: Union[str, Sequence[str], None] = '775441a93684'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add start_date and end_date columns to projected_accounts table
    op.add_column('projected_accounts', sa.Column('start_date', sa.String(), nullable=True))
    op.add_column('projected_accounts', sa.Column('end_date', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove start_date and end_date columns from projected_accounts table
    op.drop_column('projected_accounts', 'end_date')
    op.drop_column('projected_accounts', 'start_date')
