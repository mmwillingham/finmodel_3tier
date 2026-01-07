"""rename_broker_to_brokerage_add_broker_fields

Revision ID: a1b2c3d4e5f6
Revises: 0c1dbde4d918
Create Date: 2026-01-06 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9748e09dcce'
down_revision: Union[str, Sequence[str], None] = '0c1dbde4d918'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Rename broker column to brokerage
    op.alter_column('accounts', 'broker', new_column_name='brokerage')
    
    # Add new broker fields
    op.add_column('accounts', sa.Column('broker_name', sa.String(), nullable=True))
    op.add_column('accounts', sa.Column('broker_phone', sa.String(), nullable=True))
    op.add_column('accounts', sa.Column('broker_email', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove new broker fields
    op.drop_column('accounts', 'broker_email')
    op.drop_column('accounts', 'broker_phone')
    op.drop_column('accounts', 'broker_name')
    
    # Rename brokerage back to broker
    op.alter_column('accounts', 'brokerage', new_column_name='broker')

