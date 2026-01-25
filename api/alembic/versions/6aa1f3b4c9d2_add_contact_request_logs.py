"""add_contact_request_logs

Revision ID: 6aa1f3b4c9d2
Revises: 2f4b1a8c6d10
Create Date: 2026-01-24 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6aa1f3b4c9d2"
down_revision: Union[str, Sequence[str], None] = "2f4b1a8c6d10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "contact_request_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contact_type", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_contact_request_logs_id", "contact_request_logs", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_contact_request_logs_id", table_name="contact_request_logs")
    op.drop_table("contact_request_logs")
