"""drop_projection_time_series_data_table

Revision ID: b8ffd19a98dc
Revises: ea379df4dbf9
Create Date: 2026-01-14 14:05:56.801942

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8ffd19a98dc'
down_revision: Union[str, Sequence[str], None] = 'ea379df4dbf9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop projection_time_series_data table since it's redundant with data_json."""
    # Drop indexes first
    op.drop_index(op.f('ix_projection_time_series_data_year'), table_name='projection_time_series_data', if_exists=True)
    op.drop_index(op.f('ix_projection_time_series_data_value_type'), table_name='projection_time_series_data', if_exists=True)
    op.drop_index(op.f('ix_projection_time_series_data_id'), table_name='projection_time_series_data', if_exists=True)
    # Drop the table
    op.drop_table('projection_time_series_data')


def downgrade() -> None:
    """Recreate projection_time_series_data table (not recommended - data will be lost)."""
    op.create_table('projection_time_series_data',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('projection_id', sa.Integer(), nullable=False),
    sa.Column('account_id', sa.Integer(), nullable=True),
    sa.Column('year', sa.Integer(), nullable=True),
    sa.Column('value_type', sa.String(), nullable=True),
    sa.Column('value', sa.Float(), nullable=True),
    sa.ForeignKeyConstraint(['account_id'], ['projected_accounts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['projection_id'], ['projections.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_projection_time_series_data_id'), 'projection_time_series_data', ['id'], unique=False)
    op.create_index(op.f('ix_projection_time_series_data_value_type'), 'projection_time_series_data', ['value_type'], unique=False)
    op.create_index(op.f('ix_projection_time_series_data_year'), 'projection_time_series_data', ['year'], unique=False)
