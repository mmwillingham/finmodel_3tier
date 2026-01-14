"""add_about_content_to_global_settings

Revision ID: c134ab7e66dc
Revises: b8ffd19a98dc
Create Date: 2026-01-14 18:01:58.415046

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c134ab7e66dc'
down_revision: Union[str, Sequence[str], None] = 'b8ffd19a98dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('global_settings', sa.Column('about_content', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('global_settings', 'about_content')
