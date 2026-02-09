"""remove sms mfa fields

Revision ID: 20260209_remove_sms_mfa_fields
Revises: 20260205_add_passkey_last_used
Create Date: 2026-02-09 21:05:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260209_remove_sms_mfa_fields"
down_revision = "20260205_add_passkey_last_used"
branch_labels = None
depends_on = None


def _has_column(conn, table: str, column: str) -> bool:
    return conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=:table_name AND column_name=:column_name"
        ),
        {"table_name": table, "column_name": column},
    ).fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, "users", "mfa_sms_enabled"):
        op.drop_column("users", "mfa_sms_enabled")


def downgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "users", "mfa_sms_enabled"):
        op.add_column("users", sa.Column("mfa_sms_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
        op.alter_column("users", "mfa_sms_enabled", server_default=None)
