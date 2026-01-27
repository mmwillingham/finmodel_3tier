"""add_mfa_fields_and_otp_logs

Revision ID: 3b8a9b6a4d21
Revises: 0e8c6f7a2b6d
Create Date: 2026-01-26 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3b8a9b6a4d21"
down_revision: Union[str, Sequence[str], None] = "0e8c6f7a2b6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("mfa_email_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("mfa_sms_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("mfa_phone_number", sa.String(), nullable=True))
    op.alter_column("users", "mfa_enabled", server_default=None)
    op.alter_column("users", "mfa_email_enabled", server_default=None)
    op.alter_column("users", "mfa_sms_enabled", server_default=None)

    op.create_table(
        "mfa_otp_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("method", sa.String(), nullable=False),
        sa.Column("destination", sa.String(), nullable=False),
        sa.Column("code_hash", sa.String(), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_mfa_otp_logs_id", "mfa_otp_logs", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_mfa_otp_logs_id", table_name="mfa_otp_logs")
    op.drop_table("mfa_otp_logs")
    op.drop_column("users", "mfa_phone_number")
    op.drop_column("users", "mfa_sms_enabled")
    op.drop_column("users", "mfa_email_enabled")
    op.drop_column("users", "mfa_enabled")
