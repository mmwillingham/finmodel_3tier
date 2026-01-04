"""add accounts auto_disbursements and enhancements

Revision ID: a7fb52034cca
Revises: f483f8aae448
Create Date: 2026-01-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7fb52034cca'
down_revision: Union[str, Sequence[str], None] = '55b0b604d42b'  # Revise from the latest head
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create accounts table
    op.create_table(
        'accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('broker', sa.String(), nullable=False),
        sa.Column('account_name', sa.String(), nullable=False),
        sa.Column('account_number', sa.String(), nullable=True),
        sa.Column('is_retirement', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_accounts_id'), 'accounts', ['id'], unique=False)

    # Add account_id to assets table
    op.add_column('assets', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'assets', 'accounts', ['account_id'], ['id'], ondelete='SET NULL')

    # Create auto_disbursements table
    op.create_table(
        'auto_disbursements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('source_asset_id', sa.Integer(), nullable=False),
        sa.Column('target_asset_id', sa.Integer(), nullable=False),
        sa.Column('transfer_type', sa.String(), nullable=False),
        sa.Column('transfer_value', sa.Float(), nullable=False),
        sa.Column('start_date', sa.String(), nullable=True),
        sa.Column('end_date', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_asset_id'], ['assets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['target_asset_id'], ['assets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_auto_disbursements_id'), 'auto_disbursements', ['id'], unique=False)

    # Add surplus_asset_id to user_settings table
    op.add_column('user_settings', sa.Column('surplus_asset_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'user_settings', 'assets', ['surplus_asset_id'], ['id'], ondelete='SET NULL')

    # Add new fields to liabilities table
    op.add_column('liabilities', sa.Column('decrease_by_principal_yearly', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('liabilities', sa.Column('create_payment_expense', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove new fields from liabilities table
    op.drop_column('liabilities', 'create_payment_expense')
    op.drop_column('liabilities', 'decrease_by_principal_yearly')

    # Remove surplus_asset_id from user_settings table
    op.drop_constraint(None, 'user_settings', type_='foreignkey')
    op.drop_column('user_settings', 'surplus_asset_id')

    # Drop auto_disbursements table
    op.drop_index(op.f('ix_auto_disbursements_id'), table_name='auto_disbursements')
    op.drop_table('auto_disbursements')

    # Remove account_id from assets table
    op.drop_constraint(None, 'assets', type_='foreignkey')
    op.drop_column('assets', 'account_id')

    # Drop accounts table
    op.drop_index(op.f('ix_accounts_id'), table_name='accounts')
    op.drop_table('accounts')
