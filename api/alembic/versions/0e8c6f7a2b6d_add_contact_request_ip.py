"""add_contact_request_ip

Revision ID: 0e8c6f7a2b6d
Revises: 6aa1f3b4c9d2
Create Date: 2026-01-24 12:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0e8c6f7a2b6d"
down_revision: Union[str, Sequence[str], None] = "6aa1f3b4c9d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("contact_request_logs", sa.Column("ip_address", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("contact_request_logs", "ip_address")
