\"\"\"merge multiple heads after RMD patches

Revision ID: 20260203_merge_heads_rmd
Revises: ce90ec2a0c6f, allow_null_brokerage_on_accounts, 7f6d1a9c2f38, add_rmd_overrides_auto_disbursements_20260202
Create Date: 2026-02-03 13:30:00.000000
\"\"\"
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260203_merge_heads_rmd'
down_revision = ('ce90ec2a0c6f', 'allow_null_brokerage_on_accounts', '7f6d1a9c2f38', 'add_rmd_overrides_auto_disbursements_20260202')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge migration - no DB schema changes. This revision merges multiple branch heads so Alembic has a single head.
    pass


def downgrade() -> None:
    # No-op downgrade for merge-only migration.
    pass

