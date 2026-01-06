"""add_timestamps_for_auto_recalculation

Revision ID: 0c1dbde4d918
Revises: 0c8606c9d07b
Create Date: 2026-01-06 15:15:32.905852

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0c1dbde4d918'
down_revision: Union[str, Sequence[str], None] = '0c8606c9d07b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add updated_at to assets table
    op.add_column('assets', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
    # Update existing rows to have updated_at = created_at
    op.execute("UPDATE assets SET updated_at = created_at WHERE updated_at IS NULL")
    # Make it not nullable after updating
    op.alter_column('assets', 'updated_at', nullable=False, server_default=sa.func.now())
    
    # Add updated_at to liabilities table
    op.add_column('liabilities', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
    # Update existing rows to have updated_at = created_at
    op.execute("UPDATE liabilities SET updated_at = created_at WHERE updated_at IS NULL")
    # Make it not nullable after updating
    op.alter_column('liabilities', 'updated_at', nullable=False, server_default=sa.func.now())
    
    # Add last_calculated_at to projections table
    op.add_column('projections', sa.Column('last_calculated_at', sa.DateTime(timezone=True), nullable=True))
    # Update existing rows to have last_calculated_at = timestamp
    op.execute("UPDATE projections SET last_calculated_at = timestamp WHERE last_calculated_at IS NULL")


def downgrade() -> None:
    """Downgrade schema."""
    # Remove columns
    op.drop_column('projections', 'last_calculated_at')
    op.drop_column('liabilities', 'updated_at')
    op.drop_column('assets', 'updated_at')
