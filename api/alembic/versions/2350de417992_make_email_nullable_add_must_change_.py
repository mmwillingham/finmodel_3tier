"""make_email_nullable_add_must_change_password

Revision ID: 2350de417992
Revises: be67356d65e4
Create Date: 2026-01-21 09:37:48.624817

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2350de417992'
down_revision: Union[str, Sequence[str], None] = 'be67356d65e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add must_change_password column
    op.add_column('users', sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default='false'))
    
    # Make email nullable (PostgreSQL unique constraint allows multiple NULLs)
    op.alter_column('users', 'email',
                    existing_type=sa.String(),
                    nullable=True)


def downgrade() -> None:
    # Make email NOT NULL again (this will fail if there are any NULL values)
    op.alter_column('users', 'email',
                    existing_type=sa.String(),
                    nullable=False)
    
    # Remove must_change_password column
    op.drop_column('users', 'must_change_password')
