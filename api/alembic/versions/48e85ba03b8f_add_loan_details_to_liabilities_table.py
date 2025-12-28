"""Add loan details to liabilities table

Revision ID: 48e85ba03b8f
Revises: 5810c1a0cfcc
Create Date: 2025-12-28 13:56:15.169219

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '48e85ba03b8f'
down_revision: Union[str, Sequence[str], None] = 'e6d96651bbdd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('liabilities', sa.Column('loan_type', sa.String(), nullable=True, server_default='ordinary'))
    op.add_column('liabilities', sa.Column('principal_amount', sa.Float(), nullable=True))
    op.add_column('liabilities', sa.Column('interest_rate', sa.Float(), nullable=True))
    op.add_column('liabilities', sa.Column('loan_term_months', sa.Integer(), nullable=True))
    op.add_column('liabilities', sa.Column('loan_start_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('liabilities', sa.Column('monthly_payment', sa.Float(), nullable=True))
    op.add_column('liabilities', sa.Column('fees', sa.Float(), nullable=True, server_default='0.0'))

def downgrade() -> None:
    op.drop_column('liabilities', 'fees')
    op.drop_column('liabilities', 'monthly_payment')
    op.drop_column('liabilities', 'loan_start_date')
    op.drop_column('liabilities', 'loan_term_months')
    op.drop_column('liabilities', 'interest_rate')
    op.drop_column('liabilities', 'principal_amount')
    op.drop_column('liabilities', 'loan_type')
