"""add_whatif_request_logs

Revision ID: 2f4b1a8c6d10
Revises: 1c7b1e9f54b2
Create Date: 2026-01-24 12:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2f4b1a8c6d10"
down_revision: Union[str, Sequence[str], None] = "1c7b1e9f54b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "what_if_request_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_what_if_request_logs_id", "what_if_request_logs", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_what_if_request_logs_id", table_name="what_if_request_logs")
    op.drop_table("what_if_request_logs")
