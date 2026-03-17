"""add_stripe_columns_to_users

Revision ID: 20260315_add_stripe_columns
Revises: 20260226_add_doc_folders
Create Date: 2026-03-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "20260315_add_stripe_columns"
down_revision = "20260226_add_doc_folders"
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    if not _column_exists("users", "stripe_customer_id"):
        op.add_column("users", sa.Column("stripe_customer_id", sa.String(), nullable=True))
    if not _column_exists("users", "stripe_subscription_id"):
        op.add_column("users", sa.Column("stripe_subscription_id", sa.String(), nullable=True))


def downgrade() -> None:
    if _column_exists("users", "stripe_subscription_id"):
        op.drop_column("users", "stripe_subscription_id")
    if _column_exists("users", "stripe_customer_id"):
        op.drop_column("users", "stripe_customer_id")
"""add_stripe_columns_to_users

Revision ID: 20260315_add_stripe_cols
Revises: 20260226_add_doc_folders
Create Date: 2026-03-15
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260315_add_stripe_cols"
down_revision = "20260226_add_doc_folders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("users")}

    if "stripe_customer_id" not in existing_columns:
        op.add_column("users", sa.Column("stripe_customer_id", sa.String(), nullable=True))
    if "stripe_subscription_id" not in existing_columns:
        op.add_column("users", sa.Column("stripe_subscription_id", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("users")}

    if "stripe_subscription_id" in existing_columns:
        op.drop_column("users", "stripe_subscription_id")
    if "stripe_customer_id" in existing_columns:
        op.drop_column("users", "stripe_customer_id")
