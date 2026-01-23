"""allow_null_brokerage_on_accounts

Revision ID: allow_null_brokerage_on_accounts
Revises: brokerages_001
Create Date: 2026-01-23 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "allow_null_brokerage_on_accounts"
down_revision: Union[str, Sequence[str], None] = "brokerages_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Allow legacy brokerage column to be nullable now that brokerages are stored explicitly."""
    op.alter_column(
        "accounts",
        "brokerage",
        existing_type=sa.String(),
        nullable=True,
        existing_nullable=False,
    )


def downgrade() -> None:
    """Revert brokerage column back to NOT NULL (if the table is rolled back)."""
    op.execute("UPDATE accounts SET brokerage = '' WHERE brokerage IS NULL")
    op.alter_column(
        "accounts",
        "brokerage",
        existing_type=sa.String(),
        nullable=False,
        existing_nullable=True,
    )
