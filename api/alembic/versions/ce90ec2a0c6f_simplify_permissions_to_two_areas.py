"""simplify_permissions_to_two_areas

Revision ID: ce90ec2a0c6f
Revises: 2350de417992
Create Date: 2026-01-22 09:38:14.006595

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ce90ec2a0c6f'
down_revision: Union[str, Sequence[str], None] = '2350de417992'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new permission columns
    op.add_column('authorized_users', sa.Column('financial_data_permission', sa.String(), nullable=True))
    op.add_column('authorized_users', sa.Column('document_vault_permission', sa.String(), nullable=True))
    
    # Migrate existing permissions to new structure
    # financial_data_permission: use the highest permission from accounts, items, projections, charts
    # document_vault_permission: use documents_permission
    connection = op.get_bind()
    
    # Get all authorized users
    result = connection.execute(sa.text("""
        SELECT id, accounts_permission, items_permission, projections_permission, 
               charts_permission, documents_permission
        FROM authorized_users
    """))
    
    for row in result:
        auth_id = row[0]
        accounts_perm = row[1]
        items_perm = row[2]
        projections_perm = row[3]
        charts_perm = row[4]
        documents_perm = row[5]
        
        # Determine financial_data_permission: use highest permission (edit > view > null)
        financial_perms = [accounts_perm, items_perm, projections_perm, charts_perm]
        financial_data_permission = None
        if 'edit' in financial_perms:
            financial_data_permission = 'edit'
        elif 'view' in financial_perms:
            financial_data_permission = 'view'
        
        # document_vault_permission is just documents_permission
        document_vault_permission = documents_perm
        
        # Update the row
        connection.execute(sa.text("""
            UPDATE authorized_users
            SET financial_data_permission = :financial_data,
                document_vault_permission = :document_vault
            WHERE id = :auth_id
        """), {
            'financial_data': financial_data_permission,
            'document_vault': document_vault_permission,
            'auth_id': auth_id
        })
    
    # Drop old permission columns (after migration)
    op.drop_column('authorized_users', 'accounts_permission')
    op.drop_column('authorized_users', 'items_permission')
    op.drop_column('authorized_users', 'projections_permission')
    op.drop_column('authorized_users', 'charts_permission')
    op.drop_column('authorized_users', 'documents_permission')


def downgrade() -> None:
    # Add back old permission columns
    op.add_column('authorized_users', sa.Column('accounts_permission', sa.String(), nullable=True))
    op.add_column('authorized_users', sa.Column('items_permission', sa.String(), nullable=True))
    op.add_column('authorized_users', sa.Column('projections_permission', sa.String(), nullable=True))
    op.add_column('authorized_users', sa.Column('charts_permission', sa.String(), nullable=True))
    op.add_column('authorized_users', sa.Column('documents_permission', sa.String(), nullable=True))
    
    # Migrate back: spread financial_data_permission to all financial fields
    # and document_vault_permission to documents_permission
    connection = op.get_bind()
    
    result = connection.execute(sa.text("""
        SELECT id, financial_data_permission, document_vault_permission
        FROM authorized_users
    """))
    
    for row in result:
        auth_id = row[0]
        financial_perm = row[1]
        document_perm = row[2]
        
        # Spread financial_data_permission to all financial fields
        connection.execute(sa.text("""
            UPDATE authorized_users
            SET accounts_permission = :financial_perm,
                items_permission = :financial_perm,
                projections_permission = :financial_perm,
                charts_permission = :financial_perm,
                documents_permission = :document_perm
            WHERE id = :auth_id
        """), {
            'financial_perm': financial_perm,
            'document_perm': document_perm,
            'auth_id': auth_id
        })
    
    # Drop new permission columns
    op.drop_column('authorized_users', 'financial_data_permission')
    op.drop_column('authorized_users', 'document_vault_permission')
