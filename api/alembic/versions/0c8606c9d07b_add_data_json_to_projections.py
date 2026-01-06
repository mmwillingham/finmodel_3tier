"""add_data_json_to_projections

Revision ID: 0c8606c9d07b
Revises: 19805e3d7f2e
Create Date: 2026-01-06 15:05:54.723325

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0c8606c9d07b'
down_revision: Union[str, Sequence[str], None] = '19805e3d7f2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add data_json column to projections table
    op.add_column('projections', sa.Column('data_json', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove data_json column from projections table
    op.drop_column('projections', 'data_json')
