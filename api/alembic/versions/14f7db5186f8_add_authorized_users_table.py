"""add_authorized_users_table

Revision ID: 14f7db5186f8
Revises: 6bd2e42096c9
Create Date: 2026-01-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '14f7db5186f8'
down_revision: Union[str, Sequence[str], None] = '6bd2e42096c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create authorized_users table
    op.create_table(
        'authorized_users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('primary_user_id', sa.Integer(), nullable=False),
        sa.Column('authorized_user_id', sa.Integer(), nullable=False),
        sa.Column('authorized_user_email', sa.String(), nullable=False),
        sa.Column('accounts_permission', sa.String(), nullable=True),
        sa.Column('items_permission', sa.String(), nullable=True),
        sa.Column('projections_permission', sa.String(), nullable=True),
        sa.Column('charts_permission', sa.String(), nullable=True),
        sa.Column('documents_permission', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['primary_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['authorized_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('primary_user_id', 'authorized_user_id', name='uq_primary_authorized_user')
    )
    op.create_index(op.f('ix_authorized_users_id'), 'authorized_users', ['id'], unique=False)
    op.create_index(op.f('ix_authorized_users_authorized_user_email'), 'authorized_users', ['authorized_user_email'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_authorized_users_authorized_user_email'), table_name='authorized_users')
    op.drop_index(op.f('ix_authorized_users_id'), table_name='authorized_users')
    op.drop_table('authorized_users')

