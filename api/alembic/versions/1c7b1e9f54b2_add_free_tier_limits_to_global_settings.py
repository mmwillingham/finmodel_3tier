"""add_free_tier_limits_to_global_settings

Revision ID: 1c7b1e9f54b2
Revises: 9c2b1b3a7f01
Create Date: 2026-01-24 12:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1c7b1e9f54b2"
down_revision: Union[str, Sequence[str], None] = "9c2b1b3a7f01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "global_settings",
        sa.Column("free_max_projection_years", sa.Integer(), nullable=False, server_default="5"),
    )
    op.add_column(
        "global_settings",
        sa.Column("free_max_documents", sa.Integer(), nullable=False, server_default="5"),
    )
    op.add_column(
        "global_settings",
        sa.Column("free_max_whatif_monthly", sa.Integer(), nullable=False, server_default="5"),
    )


def downgrade() -> None:
    op.drop_column("global_settings", "free_max_whatif_monthly")
    op.drop_column("global_settings", "free_max_documents")
    op.drop_column("global_settings", "free_max_projection_years")
