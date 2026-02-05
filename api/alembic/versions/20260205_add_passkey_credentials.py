"""add passkey credentials table

Revision ID: 20260205_add_passkey_credentials
Revises: 20260205_add_passkey_mfa
Create Date: 2026-02-05 22:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260205_add_passkey_credentials"
down_revision = "20260205_add_passkey_mfa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='mfa_passkey_credentials'"
        )
    ).fetchone()
    if not exists:
        op.create_table(
            "mfa_passkey_credentials",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("credential_id", sa.String(), nullable=False),
            sa.Column("credential_public_key", sa.Text(), nullable=False),
            sa.Column("sign_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("device_type", sa.String(), nullable=True),
            sa.Column("backed_up", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("transports", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("credential_id", name="uq_mfa_passkey_credentials_credential_id"),
        )
        op.create_index(
            "ix_mfa_passkey_credentials_user_id",
            "mfa_passkey_credentials",
            ["user_id"],
        )

    has_user_fields = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='users' AND column_name='mfa_passkey_credential_id'"
        )
    ).fetchone()
    if has_user_fields:
        conn.execute(
            sa.text(
                "INSERT INTO mfa_passkey_credentials "
                "(user_id, credential_id, credential_public_key, sign_count, device_type, backed_up, transports) "
                "SELECT id, mfa_passkey_credential_id, mfa_passkey_public_key, "
                "COALESCE(mfa_passkey_sign_count, 0), mfa_passkey_device_type, "
                "COALESCE(mfa_passkey_backed_up, false), mfa_passkey_transports "
                "FROM users "
                "WHERE mfa_passkey_credential_id IS NOT NULL AND mfa_passkey_public_key IS NOT NULL "
                "ON CONFLICT (credential_id) DO NOTHING"
            )
        )


def downgrade() -> None:
    op.drop_index("ix_mfa_passkey_credentials_user_id", table_name="mfa_passkey_credentials")
    op.drop_table("mfa_passkey_credentials")
