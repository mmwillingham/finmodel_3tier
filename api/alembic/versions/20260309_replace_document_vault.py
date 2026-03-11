"""replace_document_vault

Revision ID: 20260309_replace_document_vault
Revises: 20260226_add_doc_folders
Create Date: 2026-03-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260309_replace_document_vault"
down_revision: Union[str, Sequence[str], None] = "20260226_add_doc_folders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f("ix_documents_id"), table_name="documents")
    op.drop_table("documents")
    op.drop_index(op.f("ix_document_folders_id"), table_name="document_folders")
    op.drop_table("document_folders")

    op.create_table(
        "document_type_definitions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("doc_type", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("fields_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_system_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("template_key", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_document_type_definitions_id"), "document_type_definitions", ["id"], unique=False)
    op.create_index(op.f("ix_document_type_definitions_category"), "document_type_definitions", ["category"], unique=False)
    op.create_index(op.f("ix_document_type_definitions_doc_type"), "document_type_definitions", ["doc_type"], unique=False)
    op.create_index(op.f("ix_document_type_definitions_template_key"), "document_type_definitions", ["template_key"], unique=False)

    op.create_table(
        "document_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("definition_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("doc_type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("folder_label", sa.String(), nullable=True),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("file_type", sa.String(), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("storage_path", sa.String(), nullable=True),
        sa.Column("content_text", sa.Text(), nullable=True),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["definition_id"], ["document_type_definitions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_document_entries_id"), "document_entries", ["id"], unique=False)
    op.create_index(op.f("ix_document_entries_owner_id"), "document_entries", ["owner_id"], unique=False)
    op.create_index(op.f("ix_document_entries_category"), "document_entries", ["category"], unique=False)
    op.create_index(op.f("ix_document_entries_doc_type"), "document_entries", ["doc_type"], unique=False)
    op.create_index(op.f("ix_document_entries_title"), "document_entries", ["title"], unique=False)
    op.create_index("ix_document_entries_search_vector", "document_entries", ["search_vector"], unique=False, postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("ix_document_entries_search_vector", table_name="document_entries", postgresql_using="gin")
    op.drop_index(op.f("ix_document_entries_title"), table_name="document_entries")
    op.drop_index(op.f("ix_document_entries_doc_type"), table_name="document_entries")
    op.drop_index(op.f("ix_document_entries_category"), table_name="document_entries")
    op.drop_index(op.f("ix_document_entries_owner_id"), table_name="document_entries")
    op.drop_index(op.f("ix_document_entries_id"), table_name="document_entries")
    op.drop_table("document_entries")

    op.drop_index(op.f("ix_document_type_definitions_template_key"), table_name="document_type_definitions")
    op.drop_index(op.f("ix_document_type_definitions_doc_type"), table_name="document_type_definitions")
    op.drop_index(op.f("ix_document_type_definitions_category"), table_name="document_type_definitions")
    op.drop_index(op.f("ix_document_type_definitions_id"), table_name="document_type_definitions")
    op.drop_table("document_type_definitions")

    op.create_table(
        "document_folders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("parent_folder_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_folder_id"], ["document_folders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_document_folders_id"), "document_folders", ["id"], unique=False)

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("folder_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("file_type", sa.String(), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("gcs_path", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["folder_id"], ["document_folders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_id"), "documents", ["id"], unique=False)
