"""add_mfa_trusted_devices

Revision ID: 7f6d1a9c2f38
Revises: 3b8a9b6a4d21
Create Date: 2026-01-26 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f6d1a9c2f38"
down_revision: Union[str, Sequence[str], None] = "3b8a9b6a4d21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mfa_trusted_devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_mfa_trusted_devices_id", "mfa_trusted_devices", ["id"], unique=False)
    op.create_index("ix_mfa_trusted_devices_token", "mfa_trusted_devices", ["device_token_hash"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_mfa_trusted_devices_token", table_name="mfa_trusted_devices")
    op.drop_index("ix_mfa_trusted_devices_id", table_name="mfa_trusted_devices")
    op.drop_table("mfa_trusted_devices")
