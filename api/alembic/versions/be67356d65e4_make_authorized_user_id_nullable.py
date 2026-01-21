"""make_authorized_user_id_nullable

Revision ID: be67356d65e4
Revises: ed615ca766e7
Create Date: 2026-01-21 09:23:10.381938

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'be67356d65e4'
down_revision: Union[str, Sequence[str], None] = 'ed615ca766e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the existing unique constraint that includes authorized_user_id
    # This constraint won't work properly with nullable authorized_user_id
    op.drop_constraint('uq_primary_authorized_user', 'authorized_users', type_='unique')
    
    # Make authorized_user_id nullable
    op.alter_column('authorized_users', 'authorized_user_id',
                    existing_type=sa.Integer(),
                    nullable=True)
    
    # Create a new unique constraint on (primary_user_id, authorized_user_email)
    # This ensures a primary user can only authorize each email once
    op.create_unique_constraint('uq_primary_authorized_email', 'authorized_users',
                               ['primary_user_id', 'authorized_user_email'])


def downgrade() -> None:
    # Drop the new unique constraint
    op.drop_constraint('uq_primary_authorized_email', 'authorized_users', type_='unique')
    
    # Make authorized_user_id NOT NULL again
    # Note: This will fail if there are any NULL values in the column
    op.alter_column('authorized_users', 'authorized_user_id',
                    existing_type=sa.Integer(),
                    nullable=False)
    
    # Restore the original unique constraint
    op.create_unique_constraint('uq_primary_authorized_user', 'authorized_users',
                               ['primary_user_id', 'authorized_user_id'])
