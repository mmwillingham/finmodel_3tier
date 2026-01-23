"""merge_ce90_and_allow_null_brokerage

Revision ID: merge_ce90_and_allow_null_brokerage
Revises: ce90ec2a0c6f, allow_null_brokerage_on_accounts
Create Date: 2026-01-23 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "merge_ce90_and_allow_null_brokerage"
down_revision: Union[str, Sequence[str], None] = (
    "ce90ec2a0c6f",
    "allow_null_brokerage_on_accounts",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge the two divergent histories into a single head."""
    pass


def downgrade() -> None:
    """Downgrade is intentionally a no-op for this merge."""
    pass
