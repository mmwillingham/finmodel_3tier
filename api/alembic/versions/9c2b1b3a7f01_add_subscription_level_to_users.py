"""add_subscription_level_to_users

Revision ID: 9c2b1b3a7f01
Revises: merge_ce90_null_brokerage
Create Date: 2026-01-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c2b1b3a7f01"
down_revision: Union[str, Sequence[str], None] = "merge_ce90_null_brokerage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("subscription_level", sa.Integer(), nullable=False, server_default="1"),
    )
    op.execute("UPDATE users SET subscription_level = 2")


def downgrade() -> None:
    op.drop_column("users", "subscription_level")
