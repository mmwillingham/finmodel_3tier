"""add_tax_filing_status_to_user_settings

Revision ID: e4f5a6b7c8d9
Revises: d3f6beed273d
Create Date: 2026-01-05 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, Sequence[str], None] = 'd3f6beed273d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add tax_filing_status column to user_settings table
    op.add_column('user_settings', sa.Column('tax_filing_status', sa.String(), nullable=False, server_default='Single'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove tax_filing_status column from user_settings table
    op.drop_column('user_settings', 'tax_filing_status')

