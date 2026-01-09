"""merge branches

Revision ID: 54886b70f774
Revises: 14f7db5186f8, brokerages_001
Create Date: 2026-01-09 16:03:32.430403

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '54886b70f774'
down_revision: Union[str, Sequence[str], None] = ('14f7db5186f8', 'brokerages_001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
