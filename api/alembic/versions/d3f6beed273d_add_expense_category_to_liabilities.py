"""add_expense_category_to_liabilities

Revision ID: d3f6beed273d
Revises: a7fb52034cca
Create Date: 2026-01-05 11:34:59.877060

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3f6beed273d'
down_revision: Union[str, Sequence[str], None] = 'a7fb52034cca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add expense_category column to liabilities table
    op.add_column('liabilities', sa.Column('expense_category', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove expense_category column from liabilities table
    op.drop_column('liabilities', 'expense_category')
