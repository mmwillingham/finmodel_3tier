"""change_is_qualified_dividend_default_to_false

Revision ID: 6116f73850f7
Revises: 3ec80f20558c
Create Date: 2026-01-15 15:48:37.345251

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6116f73850f7'
down_revision: Union[str, Sequence[str], None] = '3ec80f20558c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Change server default from 'true' to 'false' for is_qualified_dividend column
    op.alter_column('cashflow_items', 'is_qualified_dividend',
                    existing_type=sa.Boolean(),
                    existing_nullable=True,
                    server_default='false')


def downgrade() -> None:
    """Downgrade schema."""
    # Revert server default back to 'true'
    op.alter_column('cashflow_items', 'is_qualified_dividend',
                    existing_type=sa.Boolean(),
                    existing_nullable=True,
                    server_default='true')
