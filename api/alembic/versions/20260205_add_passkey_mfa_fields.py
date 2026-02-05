"""add passkey fields to users

Revision ID: 20260205_add_passkey_mfa
Revises: 20260203_add_is_roth
Create Date: 2026-02-05 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260205_add_passkey_mfa"
down_revision = "20260203_add_is_roth"
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
    columns = [
        ("mfa_passkey_enabled", sa.Boolean(), sa.text("false")),
        ("mfa_passkey_credential_id", sa.String(), None),
        ("mfa_passkey_public_key", sa.Text(), None),
        ("mfa_passkey_sign_count", sa.Integer(), sa.text("0")),
        ("mfa_passkey_device_type", sa.String(), None),
        ("mfa_passkey_backed_up", sa.Boolean(), sa.text("false")),
        ("mfa_passkey_transports", sa.JSON(), None),
        ("mfa_passkey_challenge", sa.String(), None),
        ("mfa_passkey_challenge_expires_at", sa.DateTime(timezone=True), None),
    ]
    for column_name, column_type, server_default in columns:
        if not _has_column(conn, "users", column_name):
            kwargs = {"nullable": True}
            if server_default is not None:
                kwargs["server_default"] = server_default
            op.add_column("users", sa.Column(column_name, column_type, **kwargs))


def downgrade() -> None:
    conn = op.get_bind()
    for column_name in [
        "mfa_passkey_challenge_expires_at",
        "mfa_passkey_challenge",
        "mfa_passkey_transports",
        "mfa_passkey_backed_up",
        "mfa_passkey_device_type",
        "mfa_passkey_sign_count",
        "mfa_passkey_public_key",
        "mfa_passkey_credential_id",
        "mfa_passkey_enabled",
    ]:
        if _has_column(conn, "users", column_name):
            op.drop_column("users", column_name)
