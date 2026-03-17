"""merge document vault and stripe heads

Revision ID: 20260315_merge_heads
Revises: 20260309_replace_document_vault, 20260315_add_stripe_cols
Create Date: 2026-03-15
"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "20260315_merge_heads"
down_revision: Union[str, Sequence[str], None] = (
    "20260309_replace_document_vault",
    "20260315_add_stripe_cols",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
