"""add_default_document_folders

Revision ID: 20260226_add_default_document_folders
Revises: 20260209_remove_sms_mfa_fields
Create Date: 2026-02-26

"""
from alembic import op
import sqlalchemy as sa
import json

from utils.document_folder_defaults import DEFAULT_DOCUMENT_FOLDER_STRUCTURE

# revision identifiers, used by Alembic.
revision = "20260226_add_default_document_folders"
down_revision = "20260209_remove_sms_mfa_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "global_settings",
        sa.Column("default_document_folders", sa.JSON(), nullable=True),
    )
    if DEFAULT_DOCUMENT_FOLDER_STRUCTURE:
        default_json = json.dumps(DEFAULT_DOCUMENT_FOLDER_STRUCTURE)
        op.execute(
            "UPDATE global_settings SET default_document_folders = :value WHERE default_document_folders IS NULL",
            {"value": default_json},
        )


def downgrade() -> None:
    op.drop_column("global_settings", "default_document_folders")
