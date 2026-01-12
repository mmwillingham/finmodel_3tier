"""add_social_security_fields_to_user_settings

Revision ID: af46b15d055e
Revises: 3e1baed9621f
Create Date: 2026-01-12 13:44:19.752836

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'af46b15d055e'
down_revision: Union[str, Sequence[str], None] = '3e1baed9621f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add Social Security fields for Person 1
    op.add_column('user_settings', sa.Column('person1_ss_pia', sa.Float(), nullable=True))
    op.add_column('user_settings', sa.Column('person1_ss_retirement_date', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('person1_ss_cola', sa.Float(), nullable=True))
    op.add_column('user_settings', sa.Column('person1_ss_monthly_benefit', sa.Float(), nullable=True))
    # Add Social Security fields for Person 2
    op.add_column('user_settings', sa.Column('person2_ss_pia', sa.Float(), nullable=True))
    op.add_column('user_settings', sa.Column('person2_ss_retirement_date', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('person2_ss_cola', sa.Float(), nullable=True))
    op.add_column('user_settings', sa.Column('person2_ss_monthly_benefit', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove Social Security fields for Person 2
    op.drop_column('user_settings', 'person2_ss_monthly_benefit')
    op.drop_column('user_settings', 'person2_ss_cola')
    op.drop_column('user_settings', 'person2_ss_retirement_date')
    op.drop_column('user_settings', 'person2_ss_pia')
    # Remove Social Security fields for Person 1
    op.drop_column('user_settings', 'person1_ss_monthly_benefit')
    op.drop_column('user_settings', 'person1_ss_cola')
    op.drop_column('user_settings', 'person1_ss_retirement_date')
    op.drop_column('user_settings', 'person1_ss_pia')
