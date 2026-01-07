"""add_referral_system

Revision ID: a01bcfb73ad2
Revises: c9748e09dcce
Create Date: 2026-01-06 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a01bcfb73ad2'
down_revision: Union[str, Sequence[str], None] = 'c9748e09dcce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add referred_by_id to users table
    op.add_column('users', sa.Column('referred_by_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_users_referred_by',
        'users', 'users',
        ['referred_by_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_users_referred_by_id', 'users', ['referred_by_id'], unique=False)
    
    # Create referrals table
    op.create_table('referrals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('referrer_id', sa.Integer(), nullable=False),
        sa.Column('friend_name', sa.String(), nullable=False),
        sa.Column('friend_email', sa.String(), nullable=False),
        sa.Column('registered_user_id', sa.Integer(), nullable=True),
        sa.Column('registered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['referrer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['registered_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_referrals_friend_email', 'referrals', ['friend_email'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop referrals table
    op.drop_index('ix_referrals_friend_email', table_name='referrals')
    op.drop_table('referrals')
    
    # Remove referred_by_id from users table
    op.drop_constraint('fk_users_referred_by', 'users', type_='foreignkey')
    op.drop_index('ix_users_referred_by_id', table_name='users')
    op.drop_column('users', 'referred_by_id')

