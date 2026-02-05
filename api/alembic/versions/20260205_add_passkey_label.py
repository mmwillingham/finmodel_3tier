"""add label to passkey credentials

Revision ID: 20260205_add_passkey_label
Revises: 20260205_add_passkey_credentials
Create Date: 2026-02-05 22:20:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260205_add_passkey_label"
down_revision = "20260205_add_passkey_credentials"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='mfa_passkey_credentials' AND column_name='label'"
        )
    ).fetchone()
    if not exists:
        op.add_column("mfa_passkey_credentials", sa.Column("label", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("mfa_passkey_credentials", "label")
