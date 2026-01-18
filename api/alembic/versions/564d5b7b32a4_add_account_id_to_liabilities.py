"""add_account_id_to_liabilities

Revision ID: 564d5b7b32a4
Revises: 6116f73850f7
Create Date: 2026-01-18 13:49:17.512231

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '564d5b7b32a4'
down_revision: Union[str, Sequence[str], None] = '6116f73850f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add account_id column to liabilities table
    op.add_column('liabilities', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_liabilities_account_id',
        'liabilities', 'accounts',
        ['account_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove account_id from liabilities table
    op.drop_constraint('fk_liabilities_account_id', 'liabilities', type_='foreignkey')
    op.drop_column('liabilities', 'account_id')
